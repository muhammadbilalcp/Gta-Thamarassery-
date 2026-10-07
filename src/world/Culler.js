// Distance culling and level of detail for the static world. Everything beyond the haze is
// switched off, and far vegetation swaps to a lighter model.

import * as THREE from 'three';

const _c = new THREE.Vector3();

export class Culler {
  constructor(world) {
    this.items = [];
    this.timer = 0;
    const q = world.quality;
    const scale = q.name === 'high' ? 1 : q.name === 'medium' ? 0.85 : 0.7;
    const add = (group, max, shadow = Infinity) => {
      if (!group) return;
      for (const m of group.children) {
        if (!m.isMesh) continue;
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        const s = m.isInstancedMesh && m.boundingSphere ? m.boundingSphere : m.geometry.boundingSphere;
        this.items.push({ mesh: m, x: s.center.x, y: s.center.y, z: s.center.z, r: s.radius, max: max * scale, shadow, cast: m.castShadow, lod: m.userData.lod || null });
      }
    };
    add(world.roadBuilder?.group, 1500);
    add(world.city?.group, 1600, 260);
    add(world.land?.group, 1700);
    add(world.vegetation?.group, 1000, 170);
    this.update(1, { position: new THREE.Vector3(1e6, 0, 1e6) });
  }

  update(dt, camera) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.3;
    const p = camera.position;
    for (const it of this.items) {
      _c.set(it.x, it.y, it.z);
      const d = Math.max(0, _c.distanceTo(p) - it.r);
      let visible = d < it.max;
      if (visible && it.lod) {
        // { near: true } meshes show up close, { near: false } ones take over beyond `at`.
        visible = it.lod.near ? d < it.lod.at : d >= it.lod.at;
      }
      if (it.mesh.name === 'water' || it.mesh.userData.always) visible = true;
      it.mesh.visible = visible;
      if (it.cast) it.mesh.castShadow = d < it.shadow;
    }
  }
}
