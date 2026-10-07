// Visible ground and water. The land blends lawn, leaf litter and Kerala's red laterite
// soil; the backwaters are a cheap animated PBR surface that reflects the sky.

import * as THREE from 'three';
import { WORLD } from './layout.js';
import { fbm } from '../utils/rng.js';

const CELL = 8;

export class Land {
  constructor(scene, assets, terrain) {
    this.group = new THREE.Group();
    this.group.name = 'land';
    scene.add(this.group);
    this.terrain = terrain;
    this._buildGround(assets);
    this._buildWater(assets);
    this.time = 0;
  }

  _buildGround(assets) {
    const t = this.terrain;
    const pad = 140;
    const minX = WORLD.minX - pad;
    const maxX = WORLD.maxX + pad;
    const minZ = WORLD.minZ - pad;
    const maxZ = WORLD.maxZ + pad;
    const nx = Math.ceil((maxX - minX) / CELL);
    const nz = Math.ceil((maxZ - minZ) / CELL);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    const blend = new Float32Array((nx + 1) * (nz + 1) * 2);
    let k = 0;
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = minX + i * CELL;
        const z = minZ + j * CELL;
        const h = t.height(x, z);
        pos[k * 3] = x;
        pos[k * 3 + 1] = h - 0.02;
        pos[k * 3 + 2] = z;
        uv[k * 2] = x / 7;
        uv[k * 2 + 1] = z / 7;
        // Red soil shows through in patches and along the water's edge.
        const soil = fbm(x * 0.03 + 3.1, z * 0.03 - 1.7, 4);
        const shore = THREE.MathUtils.clamp(1 - t.waterDistance(x, z) / 10, 0, 1);
        blend[k * 2] = THREE.MathUtils.clamp((soil - 0.5) * 2.4 + shore * 0.8, 0, 1);
        blend[k * 2 + 1] = fbm(x * 0.03 - 9.2, z * 0.03 + 4.4, 3);
        k++;
      }
    }
    // Cut the grid into tiles so the renderer can cull what is out of view.
    const TILE = 32;
    const tiles = [];
    for (let tj = 0; tj < nz; tj += TILE) {
      for (let ti = 0; ti < nx; ti += TILE) {
        const w = Math.min(TILE, nx - ti);
        const h = Math.min(TILE, nz - tj);
        const vp = new Float32Array((w + 1) * (h + 1) * 3);
        const vu = new Float32Array((w + 1) * (h + 1) * 2);
        const vb = new Float32Array((w + 1) * (h + 1) * 2);
        let n = 0;
        for (let j = 0; j <= h; j++) {
          for (let i = 0; i <= w; i++) {
            const src = (tj + j) * (nx + 1) + ti + i;
            vp.set(pos.subarray(src * 3, src * 3 + 3), n * 3);
            vu.set(uv.subarray(src * 2, src * 2 + 2), n * 2);
            vb.set(blend.subarray(src * 2, src * 2 + 2), n * 2);
            n++;
          }
        }
        const idx = new Uint16Array(w * h * 6);
        let q = 0;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const a = j * (w + 1) + i;
            const b = a + 1;
            const c = a + w + 1;
            const d = c + 1;
            idx[q++] = a;
            idx[q++] = c;
            idx[q++] = b;
            idx[q++] = b;
            idx[q++] = c;
            idx[q++] = d;
          }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(vp, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(vu, 2));
        geo.setAttribute('aBlend', new THREE.BufferAttribute(vb, 2));
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        tiles.push(geo);
      }
    }

    const grass = assets.textures.grass;
    const soil = assets.textures.laterite;
    const mud = assets.textures.mud;
    const mat = new THREE.MeshStandardMaterial({
      map: grass.map,
      normalMap: grass.normalMap,
      roughness: 0.96,
      color: 0xa9c486,
    });
    mat.normalScale.set(0.8, 0.8);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.mapSoil = { value: soil.map };
      shader.uniforms.mapMud = { value: mud.map };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aBlend;\nvarying vec2 vBlend;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBlend = aBlend;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D mapSoil;\nuniform sampler2D mapMud;\nvarying vec2 vBlend;')
        .replace(
          '#include <map_fragment>',
          `
          vec4 cg = texture2D(map, vMapUv);
          vec4 cg2 = texture2D(map, vMapUv * 0.23 + 0.37);
          cg.rgb = mix(cg.rgb, cg2.rgb, 0.45);
          vec4 cs = texture2D(mapSoil, vMapUv * 0.8);
          vec4 cm = texture2D(mapMud, vMapUv * 0.6);
          float ws = smoothstep(0.4, 0.8, vBlend.x + (cs.r - 0.4) * 0.5);
          float wm = smoothstep(0.5, 0.75, vBlend.y + (cm.g - 0.3) * 0.4) * (1.0 - ws);
          vec3 land = mix(cg.rgb, cm.rgb * vec3(0.95, 1.0, 0.9), wm);
          land = mix(land, cs.rgb * vec3(1.5, 1.05, 0.85), ws * 0.8);
          // Broad tonal variation so the ground never looks tiled.
          land *= 0.82 + 0.36 * vBlend.y;
          diffuseColor *= vec4(land, 1.0);
          `,
        );
    };
    for (const geo of tiles) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = 'ground';
      this.group.add(mesh);
    }

    // Flat apron out to the horizon (a frame around the detailed terrain), lost in the haze.
    const farMat = new THREE.MeshStandardMaterial({ color: 0x5f6f45, roughness: 1 });
    const R = 9000;
    const frame = [
      [minX - R, minZ - R, maxX + R, minZ],
      [minX - R, maxZ, maxX + R, maxZ + R],
      [minX - R, minZ, minX, maxZ],
      [maxX, minZ, maxX + R, maxZ],
    ];
    for (const [x0, z0, x1, z1] of frame) {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, 1);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, farMat);
      m.position.set((x0 + x1) / 2, -0.03, (z0 + z1) / 2);
      m.updateMatrix();
      m.matrixAutoUpdate = false;
      m.receiveShadow = false;
      this.group.add(m);
    }
  }

  _buildWater(assets) {
    const n = assets.textures.waterNormal;
    this.waterNormal = n;
    n.repeat.set(1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f4a3c,
      roughness: 0.12,
      metalness: 0.0,
      normalMap: n,
      envMapIntensity: 1.25,
      transparent: true,
      opacity: 0.93,
    });
    mat.normalScale.set(0.42, 0.42);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      this.waterShader = shader;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;')
        .replace(
          '#include <normal_fragment_maps>',
          `
          vec2 wuv = vWPos.xz;
          vec3 n1 = texture2D(normalMap, wuv * 0.045 + vec2(uTime * 0.012, uTime * 0.007)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(normalMap, wuv * 0.11 - vec2(uTime * 0.016, -uTime * 0.011)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(normalMap, wuv * 0.009 + vec2(-uTime * 0.004, uTime * 0.003)).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(n1 + n2 * 0.7 + n3 * 0.6);
          mapN.xy *= normalScale;
          vec3 worldN = normalize(vec3(mapN.x, mapN.z * 2.2, mapN.y));
          normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
          `,
        );
    };
    const geo = new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX + 3000, WORLD.maxZ - WORLD.minZ + 3000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((WORLD.minX + WORLD.maxX) / 2, this.terrain.waterLevel, (WORLD.minZ + WORLD.maxZ) / 2);
    mesh.receiveShadow = true;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    mesh.name = 'water';
    mesh.renderOrder = 1;
    this.group.add(mesh);
  }

  update(dt) {
    this.time += dt;
    if (this.waterShader) this.waterShader.uniforms.uTime.value = this.time;
  }
}
