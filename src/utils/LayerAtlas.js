// Packs many tiling textures into WebGL2 texture arrays so that a whole district of
// buildings - dozens of facade styles, shopfronts, roofs, walls - renders with ONE material
// and one draw call per world cell. Each vertex carries the index of its layer.

import * as THREE from 'three';
import { makeCanvas } from './canvas.js';

export class LayerAtlas {
  constructor(size = 1024, detail = 512) {
    this.size = size;
    this.detail = detail;
    this.layers = [];
    this.index = {};
  }

  /**
   * @param {string} name
   * @param {CanvasImageSource} color
   * @param {object} o  { orm, normal, rough, metal, region:[sx,sy,sw,sh], ormRegion }
   */
  add(name, color, o = {}) {
    const i = this.layers.length;
    this.layers.push({ name, color, ...o });
    this.index[name] = i;
    return i;
  }

  _pixels(source, size, region, fill) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (source) {
      const sw = source.width || source.naturalWidth;
      const sh = source.height || source.naturalHeight;
      const r = region || [0, 0, sw, sh];
      ctx.drawImage(source, r[0], r[1], r[2], r[3], 0, 0, size, size);
    } else {
      ctx.fillStyle = fill;
      ctx.fillRect(0, 0, size, size);
    }
    return ctx.getImageData(0, 0, size, size).data;
  }

  _copyFlipped(dst, offset, src, size) {
    const row = size * 4;
    for (let y = 0; y < size; y++) {
      const from = (size - 1 - y) * row;
      dst.set(src.subarray(from, from + row), offset + y * row);
    }
  }

  build(maxAniso = 8) {
    const n = this.layers.length;
    const S = this.size;
    const D = this.detail;
    const color = new Uint8Array(S * S * 4 * n);
    const orm = new Uint8Array(D * D * 4 * n);
    const normal = new Uint8Array(D * D * 4 * n);
    this.layers.forEach((l, i) => {
      this._copyFlipped(color, i * S * S * 4, this._pixels(l.color, S, l.region, '#ffffff'), S);
      const rough = Math.round((l.rough ?? 0.9) * 255);
      const metal = Math.round((l.metal ?? 0) * 255);
      let ormPx;
      if (l.orm) {
        const scale = l.orm.width / (l.color.width || l.color.naturalWidth || 1);
        const region = l.region ? l.region.map((v) => v * scale) : null;
        ormPx = this._pixels(l.orm, D, region);
      } else if (l.roughImage) {
        // Separate grey-scale roughness photo: move it into G, keep metal constant in B.
        ormPx = this._pixels(l.roughImage, D, null);
        for (let k = 0; k < ormPx.length; k += 4) {
          ormPx[k + 1] = Math.min(255, ormPx[k] * (l.roughScale ?? 1));
          ormPx[k + 2] = metal;
        }
      } else ormPx = this._pixels(null, D, null, `rgb(255,${rough},${metal})`);
      this._copyFlipped(orm, i * D * D * 4, ormPx, D);
      const nPx = l.normal ? this._pixels(l.normal, D, l.region && l.normalShared ? l.region.map((v) => v * (l.normal.width / l.color.width)) : null) : this._pixels(null, D, null, 'rgb(128,128,255)');
      this._copyFlipped(normal, i * D * D * 4, nPx, D);
    });

    const make = (data, size, srgb, aniso) => {
      const t = new THREE.DataArrayTexture(data, size, size, n);
      t.format = THREE.RGBAFormat;
      t.type = THREE.UnsignedByteType;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = aniso;
      t.needsUpdate = true;
      return t;
    };
    this.colorTexture = make(color, S, true, maxAniso);
    this.ormTexture = make(orm, D, false, Math.min(4, maxAniso));
    this.normalTexture = make(normal, D, false, Math.min(4, maxAniso));
    return this;
  }

  material(params = {}) {
    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.colorSpace = THREE.SRGBColorSpace;
    white.needsUpdate = true;
    const flat = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
    flat.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      map: white,
      normalMap: flat,
      vertexColors: true,
      roughness: 1,
      metalness: 1,
      envMapIntensity: 1.1,
      ...params,
    });
    const uniforms = {
      tColor: { value: this.colorTexture },
      tOrm: { value: this.ormTexture },
      tNormal: { value: this.normalTexture },
    };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aLayer;\nvarying float vLayer;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = aLayer;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          precision highp sampler2DArray;
          uniform sampler2DArray tColor;
          uniform sampler2DArray tOrm;
          uniform sampler2DArray tNormal;
          varying float vLayer;`,
        )
        .replace('#include <map_fragment>', 'diffuseColor *= texture(tColor, vec3(vMapUv, vLayer));')
        .replace('#include <roughnessmap_fragment>', 'vec4 ormTexel = texture(tOrm, vec3(vMapUv, vLayer));\nfloat roughnessFactor = roughness * ormTexel.g;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * ormTexel.b;')
        .replace(
          '#include <normal_fragment_maps>',
          `vec3 mapN = texture(tNormal, vec3(vNormalMapUv, vLayer)).xyz * 2.0 - 1.0;
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);`,
        );
    };
    mat.customProgramCacheKey = () => 'layer-atlas';
    return mat;
  }
}
