// Game bootstrap and main loop.

import * as THREE from 'three';
import { chooseQuality } from './core/Quality.js';
import { RenderPipeline } from './core/RenderPipeline.js';
import { Assets } from './core/Assets.js';
import { Input } from './core/Input.js';
import { CameraController } from './core/CameraController.js';
import { AudioManager } from './core/AudioManager.js';
import { World } from './world/World.js';
import { SPAWN, WORLD, LANDMARKS, NODES, EXIT_BUFFER } from './world/layout.js';
import { VehicleRenderer } from './entities/vehicles/VehicleRenderer.js';
import { VehicleManager } from './entities/VehicleManager.js';
import { Player } from './entities/Player.js';
import { Traffic } from './entities/Traffic.js';
import { Pedestrians } from './entities/Pedestrians.js';
import { PoliceSystem } from './entities/PoliceSystem.js';
import { HUD } from './ui/HUD.js';
import { clamp, saturate } from './utils/math.js';

// Resolves on the next frame, or after a short timeout when the tab is in the background
// (requestAnimationFrame does not fire for hidden tabs and loading must not stall).
const nextFrame = () =>
  new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 60);
  });

// Where fast travel drops the player for each landmark: [east, north, heading].
const TRAVEL = {
  brototype: null, // filled in from the spawn point
  forum: [6, -652, -Math.PI / 2],
  hub: [168, 46, Math.PI / 2],
  stadium: [-716, 640, Math.PI / 2],
  lulu: [-262, 1600, -Math.PI / 2],
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.params = new URLSearchParams(location.search);
    this.quality = chooseQuality();
    this.pipeline = new RenderPipeline(canvas, this.quality);
    this.renderer = this.pipeline.renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.25, this.quality.drawDistance);
    this.timer = new THREE.Timer();
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.focus = new THREE.Vector3(SPAWN.p[0], 0, SPAWN.p[1]);
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this._obstacles = [];
    this._pool = [];
    this._poolUsed = 0;
    this._nearby = [];
    this.policeSystem = null;
    this._hitEffects = [];
  }

  async start() {
    const bar = document.getElementById('bar-fill');
    const status = document.getElementById('loading-status');
    const setProgress = (p, label) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      if (label) status.textContent = label;
    };

    this.assets = new Assets(this.renderer, this.quality);
    await this.assets.load((p, label) => setProgress(p * 0.4, `Loading ${label}`));

    this.world = new World(this.scene, this.renderer, this.assets, this.quality, this);
    const steps = [...this.world.steps()];
    for (let i = 0; i < steps.length; i++) {
      const [label, fn] = steps[i];
      setProgress(0.4 + (i / steps.length) * 0.5, label);
      await nextFrame();
      await fn();
    }

    setProgress(0.92, 'Parking the cars');
    await nextFrame();
    this.vehicles = new VehicleRenderer(this.scene, this.assets);
    this.vehicleManager = new VehicleManager(this);
    // Start on the Brototype forecourt, looking at the building.
    const home = this.world.city.landmarks.brototypeFrame;
    const spot = home ? home.P(3.5, 0, 9.5 + 16) : [SPAWN.p[0], 0, SPAWN.p[1]];
    const facing = home ? Math.atan2(-home.fx, -home.fz) : SPAWN.heading;
    this.spawn = { x: spot[0], z: spot[2], heading: facing };
    this.player = new Player(this, spot[0], spot[2], facing);
    this.cameraController = new CameraController(this.camera, this);
    this.cameraController.snapBehind(facing);
    this.cameraController.pitch = -0.1; // look up at the sign
    await this.world.populate?.(this);
    this.traffic = new Traffic(this);
    this.traffic.populate(this.player.pos);
    this.pedestrians = new Pedestrians(this);
    this.policeSystem = new PoliceSystem(this);
    this.hud = new HUD(this);

    this.pipeline.init(this.scene, this.camera);
    // Compile shaders up front so the first seconds of play are smooth.
    setProgress(0.97, 'Warming up');
    await nextFrame();
    this.cameraController.update(0.016, this.input);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch (e) {
      console.warn('[game] shader precompile skipped', e);
    }
    setProgress(1, 'Ready');

    this.running = true;
    this.renderer.setAnimationLoop(() => this.frame());
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('hidden');
    const startBtn = document.getElementById('start');
    if (this.params.has('autostart')) this.begin();
    else {
      if (startBtn) {
        startBtn.classList.remove('hidden');
        startBtn.addEventListener('click', () => this.begin(), { once: true });
      }
      if (status) status.textContent = 'Thamarassery Chungam · outside Bilal Complex';
      this.onReady?.();
    }
  }

  begin() {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.add('fade');
    this.audio.start();
    this.audio.resume();
    this.input.requestLock();
    setTimeout(() => {
      if (loading) loading.remove();
    }, 900);
    this.onStarted?.();
  }

  // ---------------------------------------------------------------------------- loop
  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.step(dt);
  }

  step(dt) {
    this.time += dt;
    const input = this.input;
    this._handleKeys();

    if (!this.paused) {
      const player = this.player;
      const vehicle = player.vehicle;
      let throttle = 0;
      if (vehicle) {
        throttle = input.moveY;
        vehicle.update(dt, { throttle, steer: -input.moveX, handbrake: input.down('Space') });
        this.audio.setHorn(input.down('KeyH'), vehicle.type === 'auto' ? 'auto' : vehicle.spec.heavy ? 'bus' : vehicle.twoWheeler ? 'bike' : 'car');
      } else {
        this.audio.setHorn(false);
      }
      player.update(dt, input, this.cameraController.moveYaw);
      this._checkExits(dt);
      this.vehicleManager.update(dt, player.pos);
      this.traffic?.update(dt, player.pos);
      this.pedestrians?.update(dt, player.pos);
      this.policeSystem?.update(dt);
      this._updateHitEffects(dt);
      if (!this.debugView) this.cameraController.update(dt, input);
      this._updatePrompt();
      this.focus.copy(player.pos);
      this.world.update(dt, this.focus, this.camera);
      this.audio.update(dt, vehicle, Math.abs(throttle), this.traffic ? this.traffic.nearest(this.camera, this._nearby) : this._nearby);
      this.hud.update(dt);
    }

    this.vehicles.flush(this.camera);
    const v = this.player.vehicle;
    const speedFx = v ? saturate((Math.abs(v.vf) - 22) / 22) : 0;
    this.pipeline.adapt(dt);
    this.pipeline.render(dt, speedFx);
    input.endFrame();
  }

  _handleKeys() {
    const input = this.input;
    if (input.hit('KeyE')) this.interact();
    if (input.hit('KeyM')) {
      const open = this.hud.toggleMap();
      if (open) input.exitLock();
    }
    if (input.hit('Escape') && this.hud.mapOpen) this.hud.toggleMap(false);
    if (input.hit('F1')) this.hud.toggleControls();
    if (input.hit('KeyT')) this.cycleTravel();
    if (input.hit('KeyR') && this.player.vehicle) this.resetVehicle();
  }

  interact() {
    const p = this.player;
    if (p.vehicle) {
      if (Math.abs(p.vehicle.vf) > 4) {
        this.hud.toast('Slow down to get out');
        return;
      }
      p.exit();
      this.hud.setDriving(null);
      this.cameraController.yaw += this.cameraController.lookYaw;
      return;
    }
    const v = this.findVehicle();
    if (v) {
      p.enter(v);
      this.hud.setDriving(v);
    }
  }

  /** Nearest vehicle the player could get into: parked ones first, then slow traffic. */
  findVehicle() {
    const p = this.player;
    let v = this.vehicleManager.nearest(p.pos, 2.3);
    if (!v && this.traffic) v = this.traffic.claim(p.pos, 2.3);
    return v;
  }

  _updatePrompt() {
    const p = this.player;
    if (p.vehicle) {
      this.hud.prompt(null);
      return;
    }
    this._promptTimer = (this._promptTimer || 0) + 1;
    if (this._promptTimer % 6 !== 0) return;
    const v = this.vehicleManager.nearest(p.pos, 2.3) || this.traffic?.peek(p.pos, 2.3);
    this.hud.prompt(v ? `${v.twoWheeler ? 'Ride' : 'Drive'} ${v.spec.label}` : null);
  }

  resetVehicle() {
    const v = this.player.vehicle;
    v.vx = v.vz = v.vf = v.vl = v.vy = 0;
    v.pitch = v.roll = 0;
    // Put it back on the nearest lane.
    const lane = this.traffic?.nearestLanePoint(v.pos.x, v.pos.z);
    if (lane) {
      v.pos.set(lane.x, lane.y + 0.2, lane.z);
      v.heading = Math.atan2(lane.tx, lane.tz);
    }
    v.sync();
    this.hud.toast('Vehicle reset');
  }

  cycleTravel() {
    const keys = Object.keys(TRAVEL);
    this._travelIndex = ((this._travelIndex ?? 0) + 1) % keys.length;
    this.fastTravel(keys[this._travelIndex]);
  }

  fastTravel(key) {
    const t = key === 'brototype' ? [this.spawn.x, -this.spawn.z, this.spawn.heading] : TRAVEL[key];
    if (!t) return;
    const [east, north, heading] = t;
    const v = this.player.vehicle;
    if (v) {
      v.pos.set(east, this.world.ground.height(east, -north, 60, 100), -north);
      v.heading = heading;
      v.vx = v.vz = v.vf = v.vl = 0;
      v.sync();
    } else {
      this.player.teleport(east, -north, heading);
    }
    this.cameraController.snapBehind(heading);
    this.hud.toast(`Fast travel · ${LANDMARKS[key].name}`);
  }

  // ------------------------------------------------------------------------- services
  /** Dynamic collision circles near a point (vehicles, pedestrians). Reuses objects. */
  obstaclesNear(x, z, range, exclude) {
    const out = this._obstacles;
    out.length = 0;
    this._poolUsed = 0;
    const pool = () => {
      if (this._poolUsed >= this._pool.length) this._pool.push({});
      return this._pool[this._poolUsed++];
    };
    const mine = exclude === this.player ? this.player.vehicle : exclude;
    this.vehicleManager?.collect(x, z, range, mine, out, pool);
    this.traffic?.collect(x, z, range, out, pool);
    if (exclude !== this.player) this.pedestrians?.collect(x, z, range, out, pool);
    return out;
  }

  /**
   * The roads carry on into the haze, but the miniature ends: anyone who reaches the limit
   * of a road is turned round and pointed back at the city.
   */
  _checkExits(dt) {
    this._exitCooldown = Math.max(0, (this._exitCooldown || 0) - dt);
    if (this._exitCooldown > 0) return;
    const v = this.player.vehicle;
    const pos = v ? v.pos : this.player.pos;
    for (const id in NODES) {
      const n = NODES[id];
      if (!n.exit) continue;
      const d = Math.hypot(pos.x - n.p[0], pos.z - n.p[1]);
      if (d > EXIT_BUFFER) continue;
      // Face back down the road, a little way inside the limit.
      const node = this.world.roads.nodes[id];
      const arm = node.arms[0];
      const f = this.world.roads.armFrame(arm, EXIT_BUFFER + 40);
      const heading = Math.atan2(f.tx, f.tz);
      const lane = f.rx * 5.85;
      const lanez = f.rz * 5.85;
      // Left-hand traffic: heading away from the exit we keep to the arm's left.
      const x = f.x - lane;
      const z = f.z - lanez;
      if (v) {
        const speed = Math.min(Math.abs(v.vf), 14);
        v.pos.set(x, this.world.ground.height(x, z, 2, 3), z);
        v.heading = heading;
        v.vx = Math.sin(heading) * speed;
        v.vz = Math.cos(heading) * speed;
        v.vf = speed;
        v.vl = 0;
        v.sync();
      } else {
        this.player.teleport(x, z, heading);
      }
      this.cameraController.snapBehind(heading);
      this.hud.toast(`${node.arms[0].edge.name} carries on to ${n.toward} — this miniature ends here`, 4.5);
      this.flash();
      this._exitCooldown = 3;
      return;
    }
    // Off-road wanderers are simply kept inside the map.
    const m = 30;
    if (v) {
      const cx = clamp(v.pos.x, WORLD.minX + m, WORLD.maxX - m);
      const cz = clamp(v.pos.z, WORLD.minZ + m, WORLD.maxZ - m);
      if (cx !== v.pos.x || cz !== v.pos.z) {
        v.pos.x = cx;
        v.pos.z = cz;
        v.vx *= 0.5;
        v.vz *= 0.5;
      }
    }
  }

  flash() {
    let el = document.getElementById('flash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flash';
      el.style.cssText = 'position:fixed;inset:0;background:#0b0f10;pointer-events:none;opacity:0;transition:opacity .45s ease;z-index:4';
      document.body.appendChild(el);
    }
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity .7s ease';
      el.style.opacity = '0';
    });
    setTimeout(() => {
      el.style.opacity = '0';
    }, 80);
  }

  clampToWorld(pos) {
    const m = 40;
    pos.x = clamp(pos.x, WORLD.minX + m, WORLD.maxX - m);
    pos.z = clamp(pos.z, WORLD.minZ + m, WORLD.maxZ - m);
  }

  onImpact(strength) {
    this.audio.crash(strength);
    this.cameraController.addShake(clamp(strength / 25, 0.1, 0.8));
  }

  currentRoadName() {
    return this.world.roadNameAt?.(this.player.pos.x, this.player.pos.z) || '';
  }

  // ------------------------------------------------------------------ debug helpers
  /** Place the camera for screenshots: look from (x,y,z) at (tx,ty,tz). */
  view(x, y, z, tx, ty, tz) {
    this.debugView = true;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(tx, ty, tz);
    this.camera.updateMatrixWorld();
    this.world.update(0, this.focus.set(tx, 0, tz), this.camera);
  }

  /** view() + render, for automated screenshots. Pass hud=false to hide the overlay. */
  shot(x, y, z, tx, ty, tz, hud = false) {
    document.getElementById('hud').style.visibility = hud ? 'visible' : 'hidden';
    this.view(x, y, z, tx, ty, tz);
    if (this.world.culler) this.world.culler.timer = 0;
    if (this.pipeline.scale !== this.pipeline.maxScale) {
      this.pipeline.scale = this.pipeline.maxScale;
      this.pipeline.resize();
    }
    this.pipeline._frameTimes.length = 0;
    for (let i = 0; i < 3; i++) this.step(1 / 60);
    const info = this.renderer.info.render;
    return { calls: info.calls, tris: info.triangles };
  }

  /** Back to the gameplay camera. */
  play() {
    this.debugView = false;
    document.getElementById('hud').style.visibility = 'visible';
  }

  /**
   * Test helper: put the player in a car on `edgeId` and drive it along the lane for
   * `seconds` of simulated time. Returns a log of speed / position samples.
   */
  testDrive(edgeId, dir = 1, laneIndex = 0, seconds = 20, type = 'hatchback', startAt = 20) {
    const roads = this.world.roads;
    let lane = roads.edgeById[edgeId].lanePaths[dir][laneIndex];
    const s = {};
    lane.sample(startAt, s);
    if (this.player.vehicle) this.player.exit();
    const v = this.vehicleManager.spawn(type, s.x, s.z, Math.atan2(s.tx, s.tz), 0x1f3f78);
    v.pos.y = s.y + 0.1;
    this.player.enter(v);
    this.hud.setDriving(v);
    this.cameraController.snapBehind(v.heading);
    this.debugView = false;
    document.getElementById('hud').style.visibility = 'visible';
    let d = startAt;
    const log = [];
    const dt = 1 / 60;
    const input = this.input;
    let worst = 0;
    let total = 0;
    this.pipeline.quality.dynamicResolution = false;
    this.pipeline.scale = this.pipeline.maxScale;
    this.pipeline.resize();
    for (let i = 0; i < seconds * 60; i++) {
      // Project onto the lane and aim at a point ahead of the car.
      let best = Infinity;
      for (let k = -4; k <= 30; k++) {
        const dd = d + k;
        if (dd < 0 || dd > lane.length) continue;
        lane.sample(dd, s);
        const e = (s.x - v.pos.x) ** 2 + (s.z - v.pos.z) ** 2;
        if (e < best) {
          best = e;
          this._autoD = dd;
        }
      }
      d = this._autoD;
      if (d > lane.length - 3 && lane.next.length) {
        const straight = lane.next.find((n) => n.turn === 'S') || lane.next[0];
        lane = straight.path;
        d = 0;
      }
      const look = Math.min(lane.length, d + 9 + Math.abs(v.vf) * 0.55);
      lane.sample(look, s);
      const want = Math.atan2(s.x - v.pos.x, s.z - v.pos.z);
      let err = want - v.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;
      input.keys.clear();
      if (err > 0.04) input.keys.add('KeyA');
      else if (err < -0.04) input.keys.add('KeyD');
      if (v.kmh < 95) input.keys.add('KeyW');
      const t0 = performance.now();
      this.step(dt);
      if (i % 4 === 0) this.renderer.getContext().finish();
      const ms = performance.now() - t0;
      worst = Math.max(worst, ms);
      total += ms;
      if (i % 120 === 0) log.push({ t: i / 60, kmh: Math.round(v.kmh), x: Math.round(v.pos.x), y: +v.pos.y.toFixed(1), z: Math.round(v.pos.z), off: +Math.sqrt(best).toFixed(1) });
    }
    input.keys.clear();
    return { log, avgFrameMs: +(total / (seconds * 60)).toFixed(2), worstFrameMs: Math.round(worst), size: [this.renderer.domElement.width, this.renderer.domElement.height], calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
  }

  /** Line up one of every vehicle for inspection. */
  showcase(x = 0, z = 0, yaw = 0.6) {
    const types = ['hatchback', 'sedan', 'suv', 'auto', 'ksrtc', 'bus', 'motorcycle_r', 'scooter_r', 'motorcycle', 'scooter'];
    const colours = [0x9a1414, 0xf2f2ee, 0x1f3f78, 0x141414, 0xffffff, 0x2a63b8, 0x16171a, 0x9a1414, 0x1f3f78, 0xc8a21a];
    let off = 0;
    this._showcase = this._showcase || [];
    for (const v of this._showcase) v.dispose();
    this._showcase = [];
    types.forEach((t, i) => {
      const v = this.vehicles.create(t, colours[i]);
      const w = v.model.size.width;
      off += w / 2 + 0.9;
      v.update(x + off, 0.03, z, yaw, 0, 0, 0.3, 0);
      off += w / 2 + 0.9;
      this._showcase.push(v);
    });
    return off;
  }

  checkCombatHit(pos, heading, range = 2.2) {
    let nearestHit = null;
    let minD = range;

    // 1. Pedestrians
    if (this.pedestrians?.active) {
      for (const p of this.pedestrians.active) {
        if (!p.visible && p.idle > 1) continue;
        const dx = p.x - pos.x;
        const dz = p.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minD) {
          const fx = Math.sin(heading);
          const fz = Math.cos(heading);
          const dot = (dx * fx + dz * fz) / (dist || 1);
          if (dot > 0.15) {
            minD = dist;
            nearestHit = { target: p, type: 'ped', x: p.x, y: p.y, z: p.z };
          }
        }
      }
    }

    // 2. Police officers
    if (this.policeSystem?.officers) {
      for (const off of this.policeSystem.officers) {
        const dx = off.pos.x - pos.x;
        const dz = off.pos.z - pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minD) {
          const fx = Math.sin(heading);
          const fz = Math.cos(heading);
          const dot = (dx * fx + dz * fz) / (dist || 1);
          if (dot > 0.15) {
            minD = dist;
            nearestHit = { target: off, type: 'cop', x: off.pos.x, y: off.pos.y, z: off.pos.z };
          }
        }
      }
    }

    if (nearestHit) {
      if (nearestHit.type === 'ped') {
        const p = nearestHit.target;
        const dx = p.x - pos.x;
        const dz = p.z - pos.z;
        const len = Math.hypot(dx, dz) || 1;
        p.fx = dx / len;
        p.fz = dz / len;
        p.x += p.fx * 1.4;
        p.z += p.fz * 1.4;
        p.flee = 5.0;
        p.character?.root?.position.set(p.x, p.y, p.z);
        this.policeSystem?.addCrime(1);
      } else if (nearestHit.type === 'cop') {
        const off = nearestHit.target;
        const dx = off.pos.x - pos.x;
        const dz = off.pos.z - pos.z;
        const len = Math.hypot(dx, dz) || 1;
        off.pos.x += (dx / len) * 1.6;
        off.pos.z += (dz / len) * 1.6;
        off.health -= 35;
        off.character?.triggerPunch?.('left');
        this.policeSystem?.addCrime(2);
        if (off.health <= 0) {
          if (off.character?.root) this.scene.remove(off.character.root);
          const idx = this.policeSystem.officers.indexOf(off);
          if (idx >= 0) this.policeSystem.officers.splice(idx, 1);
        }
      }
      return nearestHit;
    }
    return null;
  }

  spawnHitEffect(x, y, z) {
    if (!this._hitGeo) {
      this._hitGeo = new THREE.RingGeometry(0.06, 0.45, 12);
      this._hitMat = new THREE.MeshBasicMaterial({
        color: 0xffe044,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
    }
    const mesh = new THREE.Mesh(this._hitGeo, this._hitMat.clone());
    mesh.position.set(x, y, z);
    mesh.lookAt(this.camera.position);
    this.scene.add(mesh);
    this._hitEffects.push({ mesh, life: 0.22, maxLife: 0.22 });
  }

  _updateHitEffects(dt) {
    for (let i = this._hitEffects.length - 1; i >= 0; i--) {
      const ef = this._hitEffects[i];
      ef.life -= dt;
      if (ef.life <= 0) {
        this.scene.remove(ef.mesh);
        ef.mesh.material?.dispose();
        this._hitEffects.splice(i, 1);
      } else {
        const t = 1 - ef.life / ef.maxLife;
        const s = 1 + t * 2.4;
        ef.mesh.scale.set(s, s, s);
        if (ef.mesh.material) ef.mesh.material.opacity = (1 - t) * 0.95;
      }
    }
  }

  flashDamage() {
    const flashEl = document.getElementById('hit-flash');
    if (flashEl) {
      flashEl.classList.add('flash');
      setTimeout(() => flashEl.classList.remove('flash'), 180);
    }
  }

  dispose() {
    this.running = false;
    this.renderer?.setAnimationLoop(null);
    this.input?.dispose?.();
    this.audio?.dispose?.();
    this.pipeline?.dispose?.();
    this.renderer?.dispose?.();
  }
}
