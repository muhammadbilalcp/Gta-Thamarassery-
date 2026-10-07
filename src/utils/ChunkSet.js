// Groups generated geometry by material and by world cell so that three.js can frustum
// cull the city piece by piece instead of drawing one monolithic mesh.

import * as THREE from 'three';
import { MeshBuilder } from './MeshBuilder.js';

export class ChunkSet {
  constructor(size = 140) {
    this.size = size;
    this.builders = new Map();
  }

  /** Builder for `material` in the cell containing (x, z). */
  get(material, x, z, opts) {
    const cx = Math.floor(x / this.size);
    const cz = Math.floor(z / this.size);
    const key = `${material}|${cx}|${cz}`;
    let b = this.builders.get(key);
    if (!b) {
      b = new MeshBuilder(opts);
      b.materialKey = material;
      this.builders.set(key, b);
    }
    return b;
  }

  /**
   * Turn every builder into a mesh. `materials` maps key -> THREE.Material, `flags` maps
   * key -> { cast, receive, smooth } overrides.
   */
  build(parent, materials, flags = {}, defaults = { cast: true, receive: true, smooth: false }) {
    const meshes = [];
    for (const [key, b] of this.builders) {
      if (b.empty) continue;
      const mat = materials[b.materialKey];
      if (!mat) {
        console.warn('[chunks] missing material', b.materialKey);
        continue;
      }
      const f = { ...defaults, ...(flags[b.materialKey] || {}) };
      const mesh = new THREE.Mesh(b.build({ smooth: f.smooth }), mat);
      mesh.castShadow = f.cast;
      mesh.receiveShadow = f.receive;
      mesh.name = key;
      mesh.matrixAutoUpdate = false;
      if (f.renderOrder !== undefined) mesh.renderOrder = f.renderOrder;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.builders.clear();
    return meshes;
  }
}
