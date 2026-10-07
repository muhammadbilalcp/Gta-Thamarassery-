// Animated humans. The meshes are rigged avatars (Mixamo-compatible skeletons); the idle /
// walk / run cycles come from a separate rig and are retargeted in world space at load so
// they work on any of the bodies regardless of bone roll or proportions.

import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const CLIPS = ['idle', 'walk', 'run'];
const norm = (name) => name.replace(/^mixamorig:?/i, '').replace(/[^A-Za-z0-9]/g, '');

const cache = new Map();

function collectBones(root) {
  const map = new Map();
  const order = [];
  root.traverse((o) => {
    if (o.isBone) {
      map.set(norm(o.name), o);
      order.push(o);
    }
  });
  return { map, order };
}

/** World-space bind (T-pose) rotation and position of every bone, keyed by normalised name. */
function bindPose(root, boneMap) {
  const rot = new Map();
  const pos = new Map();
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton;
    sk.bones.forEach((bone, i) => {
      const n = norm(bone.name);
      if (rot.has(n)) return;
      m.copy(sk.boneInverses[i]).invert().premultiply(o.bindMatrix);
      m.decompose(p, q, sc);
      rot.set(n, q.clone());
      pos.set(n, p.clone());
    });
  });
  // Bones that no skin references (end effectors) fall back to their node transform.
  for (const [n, b] of boneMap) {
    if (rot.has(n)) continue;
    rot.set(n, b.getWorldQuaternion(new THREE.Quaternion()));
    pos.set(n, b.getWorldPosition(new THREE.Vector3()));
  }
  return { rot, pos };
}

const PRIMARY_CHILD = {
  Hips: 'Spine',
  Spine: 'Spine1',
  Spine1: 'Spine2',
  Spine2: 'Neck',
  Neck: 'Head',
  Head: 'HeadTopEnd',
  LeftHand: 'LeftHandMiddle1',
  RightHand: 'RightHandMiddle1',
};

/**
 * Some avatars are modelled in an A-pose, the animation rig in a T-pose. Rotate each target
 * rest orientation so that its bone points the way the source bone does at rest; after this
 * both skeletons share the same reference pose and world-space deltas transfer cleanly.
 */
function alignRest(restT, restS, targetBones) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Quaternion();
  for (const [n, bone] of targetBones) {
    if (!restS.rot.has(n)) continue;
    let child = PRIMARY_CHILD[n];
    if (!child) {
      const kid = bone.children.find((k) => k.isBone && restS.pos.has(norm(k.name)));
      child = kid ? norm(kid.name) : null;
    }
    if (!child || !restS.pos.has(child) || !restT.pos.has(child)) continue;
    a.subVectors(restT.pos.get(child), restT.pos.get(n));
    b.subVectors(restS.pos.get(child), restS.pos.get(n));
    if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) continue;
    c.setFromUnitVectors(a.normalize(), b.normalize());
    restT.rot.set(n, c.clone().multiply(restT.rot.get(n)));
  }
}

/** Bake the source clips onto the target skeleton. Returns { clips, height }. */
function retarget(sourceGltf, targetScene, key) {
  if (cache.has(key)) return cache.get(key);
  const src = SkeletonUtils.clone(sourceGltf.scene);
  const tgt = SkeletonUtils.clone(targetScene);
  src.updateMatrixWorld(true);
  tgt.updateMatrixWorld(true);
  const S = collectBones(src);
  const T = collectBones(tgt);

  // Rest orientations come from the skin's bind matrices (the true T-pose the mesh was
  // modelled in) rather than from the node transforms, which may hold an arbitrary pose.
  const restS = bindPose(src, S.map);
  const restT = bindPose(tgt, T.map);
  alignRest(restT, restS, T.map);
  const restLocalT = new Map();
  for (const [n, b] of T.map) restLocalT.set(n, b.quaternion.clone());
  const hipsS = S.map.get('Hips');
  const hipsT = T.map.get('Hips');
  const hipRestS = restS.pos.get('Hips');
  const hipRestT = restT.pos.get('Hips');
  const scale = hipRestT.y / hipRestS.y;
  const hipParentInv = new THREE.Matrix4().copy(hipsT.parent.matrixWorld).invert();

  const mixer = new THREE.AnimationMixer(src);
  const clips = {};
  const q = new THREE.Quaternion();
  const d = new THREE.Quaternion();
  const world = new Map();
  const v = new THREE.Vector3();

  for (const name of CLIPS) {
    const clip = sourceGltf.animations.find((c) => c.name.toLowerCase() === name);
    if (!clip) continue;
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset().play();
    const fps = 30;
    const frames = Math.max(2, Math.round(clip.duration * fps));
    const times = new Float32Array(frames + 1);
    const tracks = new Map();
    for (const b of T.order) tracks.set(b, new Float32Array((frames + 1) * 4));
    const hipTrack = new Float32Array((frames + 1) * 3);

    for (let f = 0; f <= frames; f++) {
      const t = Math.min(clip.duration - 1e-4, (f / frames) * clip.duration);
      times[f] = (f / frames) * clip.duration;
      mixer.setTime(t);
      src.updateMatrixWorld(true);
      for (const b of T.order) {
        const n = norm(b.name);
        const parentWorld = b.parent && b.parent.isBone ? world.get(b.parent) : b.parent.getWorldQuaternion(new THREE.Quaternion());
        let target;
        const sb = S.map.get(n);
        if (sb) {
          sb.getWorldQuaternion(q);
          d.copy(q).multiply(restS.rot.get(n).clone().invert()); // world-space delta from rest
          target = d.clone().multiply(restT.rot.get(n));
        } else {
          target = parentWorld.clone().multiply(restLocalT.get(n));
        }
        world.set(b, target);
        const local = parentWorld.clone().invert().multiply(target);
        local.toArray(tracks.get(b), f * 4);
      }
      hipsS.getWorldPosition(v).sub(hipRestS).multiplyScalar(scale).add(hipRestT).applyMatrix4(hipParentInv);
      v.toArray(hipTrack, f * 3);
    }
    // Remove any root motion so the controller owns translation.
    const hx0 = hipTrack[0];
    const hz0 = hipTrack[2];
    const hx1 = hipTrack[frames * 3];
    const hz1 = hipTrack[frames * 3 + 2];
    for (let f = 0; f <= frames; f++) {
      const u = f / frames;
      hipTrack[f * 3] -= (hx1 - hx0) * u + hx0 - hipsT.position.x;
      hipTrack[f * 3 + 2] -= (hz1 - hz0) * u + hz0 - hipsT.position.z;
    }
    const out = [];
    for (const [b, values] of tracks) out.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, values));
    out.push(new THREE.VectorKeyframeTrack(`${hipsT.name}.position`, times, hipTrack));
    clips[name] = new THREE.AnimationClip(name, clip.duration, out);
  }
  mixer.stopAllAction();

  const box = new THREE.Box3().setFromObject(tgt);
  const result = { clips, height: box.max.y - box.min.y, restT: restT.rot, boneNames: [...T.map.keys()] };
  cache.set(key, result);
  return result;
}

// Seated poses are described as world-space rotations from the T-pose, per bone.
// Axes: X = character's left, Y = up, Z = forward. Angles in degrees, applied X then Y then Z.
const POSES = {
  ride: {
    Hips: [8, 0, 0],
    Spine: [14, 0, 0],
    Spine1: [20, 0, 0],
    Spine2: [24, 0, 0],
    Neck: [6, 0, 0],
    Head: [-4, 0, 0],
    LeftUpLeg: [-72, 0, 14],
    RightUpLeg: [-72, 0, -14],
    LeftLeg: [18, 0, 8],
    RightLeg: [18, 0, -8],
    LeftFoot: [10, 0, 0],
    RightFoot: [10, 0, 0],
    LeftShoulder: [0, -12, 0],
    RightShoulder: [0, 12, 0],
    LeftArm: [0, -62, -34],
    RightArm: [0, 62, 34],
    LeftForeArm: [0, -92, -22],
    RightForeArm: [0, 92, 22],
    LeftHand: [0, -90, -20],
    RightHand: [0, 90, 20],
  },
};

const _e = new THREE.Euler();

export class Character {
  /**
   * @param {object} assets
   * @param {'avatar'|'michelle'|'xbot'} kind
   */
  constructor(assets, kind = 'avatar', { tint = null, height = 1.74 } = {}) {
    const gltf = assets.models[kind] || assets.models[kind.replace('Lite', '')] || assets.models.xbot;
    const data = kind === 'xbot' ? null : retarget(assets.models.xbot, gltf.scene, kind.replace('Lite', ''));
    this.kind = kind;
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    this.root.add(this.model);
    const nativeHeight = data ? data.height : new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3()).y;
    this.model.scale.setScalar(height / nativeHeight);
    this.height = height;
    this.bones = new Map();
    this.model.traverse((o) => {
      if (o.isBone) this.bones.set(norm(o.name), o);
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false;
        if (kind.startsWith('avatar') && /headwear|hat/i.test(o.material?.name || '')) o.visible = false;
        if (tint && o.material) {
          const name = o.material.name || '';
          if (tint.all || /Outfit_Top|Ch03|Beta_Surface|HighLimbs/i.test(name)) {
            o.material = o.material.clone();
            o.material.color.multiply(new THREE.Color(tint.top ?? 0xffffff));
          } else if (/Outfit_Bottom/i.test(name) && tint.bottom) {
            o.material = o.material.clone();
            o.material.color.multiply(new THREE.Color(tint.bottom));
          }
        }
        if (o.material) o.material.envMapIntensity = 0.7;
      }
    });
    this.rest = data ? data.restT : null;

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    const clips = data ? data.clips : Object.fromEntries(CLIPS.map((n) => [n, gltf.animations.find((c) => c.name === n)]));
    for (const name of CLIPS) {
      if (!clips[name]) continue;
      const a = this.mixer.clipAction(clips[name]);
      a.enabled = true;
      a.setEffectiveWeight(name === 'idle' ? 1 : 0);
      a.play();
      this.actions[name] = a;
    }
    this.weights = { idle: 1, walk: 0, run: 0 };
    this.walkRef = 1.55; // ground speed the walk cycle was authored for (m/s)
    this.runRef = 4.4;
    this.pose = null;
    this.air = 0;
  }

  /** Blend the locomotion cycles for a ground speed in m/s. */
  locomotion(speed, dt, airborne = false) {
    const w = this.weights;
    let ti = 0;
    let tw = 0;
    let tr = 0;
    if (speed < 0.25) ti = 1;
    else if (speed < 3.2) {
      tw = 1;
    } else tr = 1;
    if (airborne) {
      ti = 0;
      tw = 0;
      tr = 1;
    }
    const k = 1 - Math.exp(-9 * dt);
    w.idle += (ti - w.idle) * k;
    w.walk += (tw - w.walk) * k;
    w.run += (tr - w.run) * k;
    const a = this.actions;
    a.idle?.setEffectiveWeight(w.idle);
    a.walk?.setEffectiveWeight(w.walk);
    a.run?.setEffectiveWeight(w.run);
    if (a.walk) a.walk.timeScale = THREE.MathUtils.clamp(speed / this.walkRef, 0.6, 1.9);
    if (a.run) a.run.timeScale = airborne ? 0.35 : THREE.MathUtils.clamp(speed / this.runRef, 0.8, 1.7);
  }

  /** Hold a static pose (riding). Pass null to return to animation. */
  setPose(name) {
    this.pose = name ? POSES[name] : null;
    for (const key in this.actions) this.actions[key].paused = !!name;
    if (this.pose) this.applyPose();
  }

  applyPose() {
    if (!this.rest) return;
    const world = new Map();
    const q = new THREE.Quaternion();
    const rootQ = this.model.getWorldQuaternion(new THREE.Quaternion());
    const rootInv = rootQ.clone().invert();
    this.model.traverse((b) => {
      if (!b.isBone) return;
      const n = norm(b.name);
      // Work in the model's own space so the pose is independent of where the character faces.
      const parentWorld = b.parent.isBone ? world.get(b.parent) : rootInv.clone().multiply(b.parent.getWorldQuaternion(new THREE.Quaternion()));
      const rest = this.rest.get(n);
      const p = this.pose[n];
      let target;
      if (p && rest) {
        _e.set(THREE.MathUtils.degToRad(p[0]), THREE.MathUtils.degToRad(p[1]), THREE.MathUtils.degToRad(p[2]), 'XYZ');
        q.setFromEuler(_e);
        target = q.clone().multiply(rest);
      } else if (rest && b.parent.isBone) {
        // Keep the rest orientation relative to the (posed) parent.
        const parentRest = this.rest.get(norm(b.parent.name));
        target = parentWorld.clone().multiply(parentRest.clone().invert().multiply(rest));
      } else {
        target = rest ? rest.clone() : parentWorld.clone().multiply(b.quaternion);
      }
      world.set(b, target);
      b.quaternion.copy(parentWorld.clone().invert().multiply(target));
    });
  }

  update(dt) {
    if (this.pose) return;
    this.mixer.update(dt);
  }

  setVisible(v) {
    this.root.visible = v;
  }
}
