// Loads every external asset once and hands out shared textures / models.
//
// Asset sources (all free to use, see docs/ASSETS.md):
//   - Poly Haven (CC0): sky HDRI and the PBR texture sets
//   - three.js examples: character rigs + animations, water normal map
//   - Fontsource (OFL): Anek Malayalam, Noto Sans Malayalam, Noto Sans Devanagari

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

const TEXTURE_SETS = ['asphalt', 'pavers', 'plaza', 'concrete', 'grass', 'laterite', 'mud', 'rooftile', 'plaster', 'mossy', 'corrugated'];

const MODELS = {
  avatar: 'readyplayer.me.glb',
  xbot: 'Xbot.glb',
  michelle: 'Michelle.glb',
};

const FONTS = [
  ['Anek Malayalam', 'anek-malayalam-malayalam-400-normal.woff2', '400', 'U+0307,U+0323,U+0951-0952,U+0964-0965,U+0D00-0D7F,U+1CDA,U+1CF2,U+200C-200D,U+20B9,U+25CC,U+A830-A832'],
  ['Anek Malayalam', 'anek-malayalam-malayalam-700-normal.woff2', '700', 'U+0307,U+0323,U+0951-0952,U+0964-0965,U+0D00-0D7F,U+1CDA,U+1CF2,U+200C-200D,U+20B9,U+25CC,U+A830-A832'],
  ['Anek Malayalam', 'anek-malayalam-malayalam-800-normal.woff2', '800', 'U+0307,U+0323,U+0951-0952,U+0964-0965,U+0D00-0D7F,U+1CDA,U+1CF2,U+200C-200D,U+20B9,U+25CC,U+A830-A832'],
  ['Anek Malayalam', 'anek-malayalam-latin-400-normal.woff2', '400', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['Anek Malayalam', 'anek-malayalam-latin-700-normal.woff2', '700', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['Anek Malayalam', 'anek-malayalam-latin-800-normal.woff2', '800', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['Noto Sans Malayalam', 'noto-sans-malayalam-malayalam-400-normal.woff2', '400', null],
  ['Noto Sans Malayalam', 'noto-sans-malayalam-malayalam-700-normal.woff2', '700', null],
  ['Noto Sans Devanagari', 'noto-sans-devanagari-devanagari-400-normal.woff2', '400', null],
  ['Noto Sans Devanagari', 'noto-sans-devanagari-devanagari-700-normal.woff2', '700', null],
];

export const SIGN_FONT = '"Anek Malayalam", "Noto Sans Malayalam", "Noto Sans Devanagari", "Helvetica Neue", Arial, sans-serif';

export class Assets {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.textures = {};
    this.models = {};
    this.sky = null;
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  }

  async load(onProgress) {
    const jobs = [];
    let done = 0;
    const track = (p, label) => {
      jobs.push(
        p.then(
          (v) => {
            done++;
            onProgress?.(done / jobs.length, label);
            return v;
          },
          (err) => {
            done++;
            console.warn(`[assets] failed to load ${label}`, err);
            onProgress?.(done / jobs.length, label);
            return null;
          },
        ),
      );
    };

    const texLoader = new THREE.TextureLoader();
    for (const name of TEXTURE_SETS) {
      this.textures[name] = {};
      for (const [suffix, key] of [
        ['diff', 'map'],
        ['nor', 'normalMap'],
        ['rough', 'roughnessMap'],
      ]) {
        track(
          texLoader.loadAsync(`/assets/textures/${name}_${suffix}.jpg`).then((t) => {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = this.maxAniso;
            t.colorSpace = key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            this.textures[name][key] = t;
          }),
          `${name} ${suffix}`,
        );
      }
    }
    track(
      texLoader.loadAsync('/assets/textures/waternormals.jpg').then((t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = THREE.NoColorSpace;
        this.textures.waterNormal = t;
      }),
      'water',
    );

    const gltf = new GLTFLoader();
    for (const key in MODELS) {
      track(
        gltf.loadAsync(`/assets/models/${MODELS[key]}`).then((g) => {
          this.models[key] = g;
        }),
        MODELS[key],
      );
    }

    const hdrFile = this.quality.sky4k ? 'sky_4k.hdr' : 'sky_2k.hdr';
    track(
      new HDRLoader().loadAsync(`/assets/hdri/${hdrFile}`).then((t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        this.sky = t;
      }),
      'sky',
    );

    for (const [family, file, weight, range] of FONTS) {
      const desc = { weight, style: 'normal' };
      if (range) desc.unicodeRange = range;
      const face = new FontFace(family, `url(/assets/fonts/${file})`, desc);
      track(
        face.load().then((f) => {
          document.fonts.add(f);
        }),
        `font ${family}`,
      );
    }

    await Promise.all(jobs);
    // Lighter copies of the character meshes for passers-by.
    try {
      await MeshoptSimplifier.ready;
      for (const key of ['avatar', 'michelle']) {
        if (this.models[key]) this.models[`${key}Lite`] = simplifyModel(this.models[key], key === 'michelle' ? 0.22 : 0.4);
      }
    } catch (e) {
      console.warn('[assets] mesh simplification unavailable', e);
    }
    // Make sure canvas text can use the fonts straight away.
    try {
      await Promise.all([
        document.fonts.load(`700 32px "Anek Malayalam"`, 'കൊച്ചി Kochi'),
        document.fonts.load(`700 32px "Noto Sans Devanagari"`, 'कोच्चि'),
      ]);
    } catch (e) {
      console.warn('[assets] font warmup failed', e);
    }
  }

  /**
   * A PBR material from a downloaded texture set. `repeat` is tiles per UV unit, so meshes
   * that use world-space UVs (1 unit = 1 m) pass 1 / tileSizeInMetres.
   */
  material(name, { repeat = 1, color = 0xffffff, roughness = 1, metalness = 0, normalScale = 1, ...rest } = {}) {
    const set = this.textures[name];
    const clone = (t) => {
      if (!t) return null;
      const c = t.clone();
      c.repeat.set(repeat, repeat);
      c.needsUpdate = true;
      return c;
    };
    const m = new THREE.MeshStandardMaterial({
      map: clone(set.map),
      normalMap: clone(set.normalMap),
      roughnessMap: clone(set.roughnessMap),
      color,
      roughness,
      metalness,
      ...rest,
    });
    m.normalScale.set(normalScale, normalScale);
    return m;
  }
}

/**
 * Copy of a skinned model whose meshes use a reduced index buffer. Vertices (and therefore
 * skin weights) are shared with the original, only the triangle list shrinks.
 */
function simplifyModel(gltf, ratio) {
  const scene = SkeletonUtils.clone(gltf.scene);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry.index) return;
    const src = o.geometry;
    const pos = src.attributes.position;
    const indices = new Uint32Array(src.index.array);
    const target = Math.max(300, Math.floor((indices.length * ratio) / 3) * 3);
    const positions = pos.array instanceof Float32Array ? pos.array : new Float32Array(pos.array);
    const stride = pos.isInterleavedBufferAttribute ? pos.data.stride : 3;
    const [out] = MeshoptSimplifier.simplify(indices, positions, stride, target, 0.04);
    const geo = new THREE.BufferGeometry();
    for (const name in src.attributes) geo.setAttribute(name, src.attributes[name]);
    geo.morphAttributes = src.morphAttributes;
    geo.morphTargetsRelative = src.morphTargetsRelative;
    geo.setIndex(new THREE.BufferAttribute(out, 1));
    geo.boundingBox = src.boundingBox;
    geo.boundingSphere = src.boundingSphere;
    o.geometry = geo;
  });
  return { scene, animations: gltf.animations };
}
