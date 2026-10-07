// Draws every vehicle in the game with a handful of instanced draw calls: one instanced
// mesh per body type and a single one for all wheels.

import * as THREE from 'three';
import { buildVehicleAtlas } from './atlas.js';
import { buildModel, buildWheel } from './models.js';

const CAPACITY = {
  hatchback: 72,
  sedan: 52,
  suv: 52,
  auto: 56,
  ksrtc: 14,
  bus: 14,
  motorcycle: 36,
  scooter: 36,
  motorcycle_r: 40,
  scooter_r: 40,
};
const VARIANTS = 2;
const WHEEL_CAPACITY = 900;

const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color();

export function makeVehicleMaterial(atlasTexture) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: atlasTexture,
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.25,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aSurf;
        attribute vec2 aState;
        varying vec4 vSurf;
        varying vec2 vState;`,
      )
      .replace(
        '#include <color_vertex>',
        `vColor = vec4(1.0);
        vColor.rgb *= color;
        #ifdef USE_INSTANCING_COLOR
          vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aSurf.x);
        #endif
        vSurf = aSurf;
        vState = aState;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSurf;\nvarying vec2 vState;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurf.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.z;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float lt = vSurf.w;
          float glow = 0.0;
          if (lt > 0.5 && lt < 1.5) glow = 0.12 + vState.y * 3.0;
          else if (lt > 1.5 && lt < 2.5) glow = 0.05 + vState.x * 5.0;
          else if (lt > 2.5) glow = 0.03;
          totalEmissiveRadiance += diffuseColor.rgb * glow;
        }`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= vSurf.x;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'vehicle-v1';
  return mat;
}

const _frustum = new THREE.Frustum();
const _proj = new THREE.Matrix4();
const _sphere = new THREE.Sphere();

/** One body type: the instanced mesh plus every live vehicle that uses it. */
class Pool {
  constructor(mesh, model) {
    this.mesh = mesh;
    this.model = model;
    this.visuals = [];
    this.capacity = mesh.instanceMatrix.count;
    mesh.count = 0;
  }
}

export class VehicleVisual {
  constructor(renderer, type, pool, model) {
    this.renderer = renderer;
    this.type = type;
    this.pool = pool;
    this.model = model;
    this.matrix = new THREE.Matrix4();
    this.wheelMatrices = model.wheels.map(() => new THREE.Matrix4());
    this.colour = new THREE.Color(0xffffff);
    this.brake = 0;
    this.head = 0;
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.placed = false;
    this.alive = true;
  }

  setColor(hex) {
    this.colour.set(hex);
    this.color = hex;
  }

  /** brake / headlight state, both 0..1 */
  setLights(brake, head = 0) {
    this.brake = brake;
    this.head = head;
  }

  /**
   * Place the vehicle. Angles in radians: yaw about Y, pitch nose-up positive, roll to the right positive.
   * `spin` is the accumulated wheel rotation, `steer` the front wheel angle.
   */
  update(x, y, z, yaw, pitch, roll, steer, spin) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.placed = true;
    _e.set(-pitch, yaw, roll, 'YXZ');
    _q.setFromEuler(_e);
    _p.set(x, y, z);
    _s.set(1, 1, 1);
    this.matrix.compose(_p, _q, _s);
    const wheels = this.model.wheels;
    for (let i = 0; i < wheels.length; i++) {
      const w = wheels[i];
      _e.set(w.side < 0 ? -spin : spin, (w.steer ? steer : 0) + (w.side < 0 ? Math.PI : 0), 0, 'YXZ');
      _q.setFromEuler(_e);
      _p.set(w.x, w.y, w.z);
      _s.set(w.w, w.r, w.r);
      _w.compose(_p, _q, _s);
      this.wheelMatrices[i].multiplyMatrices(this.matrix, _w);
    }
  }

  dispose() {
    if (!this.alive) return;
    this.alive = false;
    const i = this.pool.visuals.indexOf(this);
    if (i >= 0) this.pool.visuals.splice(i, 1);
  }
}

export class VehicleRenderer {
  constructor(scene, assets) {
    this.scene = scene;
    const atlas = buildVehicleAtlas(assets.maxAniso);
    this.atlas = atlas;
    this.material = makeVehicleMaterial(atlas.texture);
    this.pools = {};
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    scene.add(this.group);

    for (const type in CAPACITY) {
      const variants = [];
      const per = Math.ceil(CAPACITY[type] / VARIANTS);
      for (let v = 0; v < VARIANTS; v++) {
        const model = buildModel(type, atlas.rects, v);
        const geo = model.geometry;
        geo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(per * 2), 2));
        const mesh = new THREE.InstancedMesh(geo, this.material, per);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.name = `${type}#${v}`;
        mesh.setColorAt(0, _c.set(0xffffff));
        this.group.add(mesh);
        variants.push(new Pool(mesh, model));
      }
      this.pools[type] = variants;
    }

    const wheelGeo = buildWheel();
    wheelGeo.setAttribute('aState', new THREE.InstancedBufferAttribute(new Float32Array(WHEEL_CAPACITY * 2), 2));
    this.wheelMesh = new THREE.InstancedMesh(wheelGeo, this.material, WHEEL_CAPACITY);
    this.wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wheelMesh.castShadow = true;
    this.wheelMesh.receiveShadow = true;
    this.wheelMesh.frustumCulled = false;
    this.wheelMesh.name = 'wheels';
    this.wheelMesh.setColorAt(0, _c.set(0xffffff));
    this.wheelMesh.count = 0;
    this.white = new THREE.Color(0xffffff);
    this.group.add(this.wheelMesh);
  }

  model(type) {
    return this.pools[type][0].model;
  }

  /** Returns null when the pool for this type is exhausted. */
  create(type, colour = 0xffffff) {
    const variants = this.pools[type];
    if (!variants) throw new Error(`no such vehicle type: ${type}`);
    let pool = variants[Math.floor(Math.random() * variants.length)];
    if (pool.visuals.length >= pool.capacity) pool = variants.find((v) => v.visuals.length < v.capacity);
    if (!pool) return null;
    const visual = new VehicleVisual(this, type, pool, pool.model);
    pool.visuals.push(visual);
    visual.setColor(colour);
    return visual;
  }

  get liveCount() {
    let n = 0;
    for (const t in this.pools) for (const p of this.pools[t]) n += p.visuals.length;
    return n;
  }

  /**
   * Write the instances the camera can actually see. Vehicles behind the camera or far away
   * cost nothing; ones close by are always drawn so their shadows do not pop.
   */
  flush(camera) {
    _proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_proj);
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const wm = this.wheelMesh;
    const wheelCap = wm.instanceMatrix.count;
    let wheels = 0;
    let drawn = 0;
    for (const type in this.pools) {
      for (const pool of this.pools[type]) {
        const mesh = pool.mesh;
        const state = mesh.geometry.attributes.aState.array;
        const radius = pool.model.size.length * 0.6 + 1;
        let n = 0;
        for (const v of pool.visuals) {
          if (!v.placed || n >= pool.capacity) continue;
          const dx = v.x - cx;
          const dy = v.y - cy;
          const dz = v.z - cz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > 520 * 520) continue;
          if (d2 > 36 * 36) {
            _sphere.center.set(v.x, v.y + 1, v.z);
            _sphere.radius = radius;
            if (!_frustum.intersectsSphere(_sphere)) continue;
          }
          mesh.setMatrixAt(n, v.matrix);
          mesh.setColorAt(n, v.colour);
          state[n * 2] = v.brake;
          state[n * 2 + 1] = v.head;
          n++;
          for (let i = 0; i < v.wheelMatrices.length && wheels < wheelCap; i++) {
            wm.setMatrixAt(wheels, v.wheelMatrices[i]);
            wheels++;
          }
        }
        mesh.count = n;
        drawn += n;
        if (n) {
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor.needsUpdate = true;
          mesh.geometry.attributes.aState.needsUpdate = true;
        }
      }
    }
    if (!this._wheelsWhite) {
      for (let i = 0; i < wheelCap; i++) wm.setColorAt(i, this.white);
      wm.instanceColor.needsUpdate = true;
      this._wheelsWhite = true;
    }
    wm.count = wheels;
    wm.instanceMatrix.needsUpdate = true;
    this.drawn = drawn;
  }
}
