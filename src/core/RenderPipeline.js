// Renderer + post processing: MSAA HDR target, a touch of bloom, filmic tone mapping and
// a light grade (warmth, contrast, vignette). Resolution scales itself to hold frame rate.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.34 },
    uWarmth: { value: 0.035 },
    uContrast: { value: 1.1 },
    uSaturation: { value: 1.14 },
    uSpeed: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uWarmth;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uSpeed;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      // Subtle radial smear at speed.
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (uSpeed > 0.01) {
        vec3 acc = col;
        float amt = uSpeed * r2 * 0.05;
        acc += texture2D(tDiffuse, vUv - c * amt).rgb;
        acc += texture2D(tDiffuse, vUv - c * amt * 2.0).rgb;
        acc += texture2D(tDiffuse, vUv - c * amt * 3.0).rgb;
        col = acc * 0.25;
      }
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col += vec3(uWarmth, uWarmth * 0.35, -uWarmth * 0.8) * smoothstep(0.1, 0.9, l);
      col *= 1.0 - uVignette * smoothstep(0.12, 0.62, r2);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class RenderPipeline {
  constructor(canvas, quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.86;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;
    this.scale = quality.pixelRatio;
    this.minScale = Math.min(0.6, this.scale);
    this.maxScale = quality.pixelRatio;
    this._frameTimes = [];
    this._sinceAdjust = 0;
  }

  init(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const gl = this.renderer.getContext();
    const maxSamples = gl.getParameter(gl.MAX_SAMPLES) || 0;
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: Math.min(this.quality.msaa, maxSamples),
      depthBuffer: true,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    if (this.quality.bloom) {
      this.bloom = new UnrealBloomPass(size.clone().multiplyScalar(0.5), 0.2, 0.5, 2.8);
      this.composer.addPass(this.bloom);
    }
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.scale);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.scale);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Dynamic resolution: drop the pixel ratio when frames run long, raise it when there is headroom. */
  adapt(dt) {
    if (!this.quality.dynamicResolution) return;
    this._frameTimes.push(dt);
    this._sinceAdjust += dt;
    if (this._frameTimes.length > 90) this._frameTimes.shift();
    if (this._sinceAdjust < 2.5 || this._frameTimes.length < 60) return;
    this._sinceAdjust = 0;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    const fps = 1 / avg;
    let next = this.scale;
    if (fps < 44) next = Math.max(this.minScale, this.scale - 0.12);
    else if (fps > 57 && this.scale < this.maxScale) next = Math.min(this.maxScale, this.scale + 0.06);
    if (Math.abs(next - this.scale) > 0.01) {
      this.scale = next;
      this.resize();
      this._frameTimes.length = 0;
    }
  }

  render(dt, speedFactor = 0) {
    this.grade.uniforms.uSpeed.value = speedFactor;
    this.renderer.info.reset();
    this.composer.render(dt);
  }
}
