// Sky, sun, image based lighting and haze: a humid Kochi afternoon around 4 pm.

import * as THREE from 'three';

// Direction *towards* the sun on the ground plane. West-south-west, as it is over
// Kochi in the late afternoon (+X east, +Z south).
const SUN_AZIMUTH = new THREE.Vector2(-0.97, 0.24).normalize();

export class Environment {
  constructor(scene, renderer, assets, quality) {
    this.scene = scene;
    this.quality = quality;
    const sky = assets.sky;

    const found = sky ? findSun(sky) : { dir: new THREE.Vector3(0.5, 0.65, 0.3).normalize() };
    // Rotate the sky so that its sun sits where we want the light to come from.
    const betaMap = Math.atan2(found.dir.x, found.dir.z);
    const betaWant = Math.atan2(SUN_AZIMUTH.x, SUN_AZIMUTH.y);
    const theta = betaWant - betaMap;
    this.sunDir = found.dir.clone().applyEuler(new THREE.Euler(0, theta, 0)).normalize();
    // Keep the light a touch lower than the photographed sun for longer, warmer shadows.
    const elev = Math.asin(this.sunDir.y);
    const targetElev = Math.min(elev, THREE.MathUtils.degToRad(38));
    const flat = Math.hypot(this.sunDir.x, this.sunDir.z) || 1;
    this.sunDir.set((this.sunDir.x / flat) * Math.cos(targetElev), Math.sin(targetElev), (this.sunDir.z / flat) * Math.cos(targetElev));

    if (sky) {
      scene.background = sky;
      scene.backgroundRotation.set(0, theta, 0);
      scene.backgroundIntensity = 0.92;
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(sky).texture;
      pmrem.dispose();
      scene.environment = env;
      scene.environmentRotation.set(0, theta, 0);
      scene.environmentIntensity = 1.35;
    } else {
      scene.background = new THREE.Color(0xa9c4d8);
    }

    // Tropical haze: warm, slightly milky.
    this.fogColor = new THREE.Color(0xc3cdd0);
    scene.fog = new THREE.FogExp2(this.fogColor, 0.00122);

    this.sun = new THREE.DirectionalLight(0xffe2bd, 3.0);
    this.sun.castShadow = true;
    const size = quality.shadowSize;
    this.sun.shadow.mapSize.set(size, size);
    this.range = quality.shadowRange;
    const cam = this.sun.shadow.camera;
    cam.left = -this.range;
    cam.right = this.range;
    cam.top = this.range;
    cam.bottom = -this.range;
    cam.near = 1;
    cam.far = 520;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.06;
    this.sun.shadow.radius = 2.2;
    this.sun.shadow.blurSamples = 8;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // Soft sky fill so shaded sides are blue-grey rather than black.
    this.fill = new THREE.HemisphereLight(0xd6e6f2, 0x8a7d63, 0.7);
    scene.add(this.fill);

    this._focus = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    const fwd = this.sunDir.clone().negate();
    this._right.crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
    this._up.crossVectors(fwd, this._right).normalize();
  }

  /** Centre the shadow volume on the player, snapped to shadow texels to avoid shimmer. */
  update(focus) {
    const texel = (this.range * 2) / this.sun.shadow.mapSize.x;
    const r = focus.dot(this._right);
    const u = focus.dot(this._up);
    const sr = Math.round(r / texel) * texel;
    const su = Math.round(u / texel) * texel;
    this._focus.copy(focus).addScaledVector(this._right, sr - r).addScaledVector(this._up, su - u);
    this.sun.target.position.copy(this._focus);
    this.sun.position.copy(this._focus).addScaledVector(this.sunDir, 260);
    this.sun.target.updateMatrixWorld();
  }
}

function findSun(tex) {
  const { data, width, height } = tex.image;
  const half = data instanceof Uint16Array;
  const get = (i) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  let best = -1;
  let bi = 0;
  let bj = 0;
  const step = Math.max(1, Math.floor(width / 1024));
  for (let j = 0; j < height / 2; j += step) {
    for (let i = 0; i < width; i += step) {
      const k = (j * width + i) * 4;
      const lum = get(k) * 0.2126 + get(k + 1) * 0.7152 + get(k + 2) * 0.0722;
      if (lum > best) {
        best = lum;
        bi = i;
        bj = j;
      }
    }
  }
  const u = (bi + 0.5) / width;
  // Radiance files store the top scanline first; with flipY the first row is v = 1.
  const v = tex.flipY ? 1 - (bj + 0.5) / height : (bj + 0.5) / height;
  const a = (u - 0.5) * Math.PI * 2;
  const el = (v - 0.5) * Math.PI;
  const dir = new THREE.Vector3(Math.cos(el) * Math.cos(a), Math.sin(el), Math.cos(el) * Math.sin(a));
  return { dir, lum: best };
}
