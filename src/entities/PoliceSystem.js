import * as THREE from 'three';
import { clamp } from '../utils/math.js';
import { Character } from './Character.js';

export class PoliceSystem {
  constructor(game) {
    this.game = game;
    this.wantedLevel = 0; // 0 to 5 stars
    this.maxWanted = 5;
    this.coolDownTimer = 0;
    this.cars = []; // Active police cars
    this.officers = []; // Active police officers
    this.busted = false;
    this.bustedTimer = 0;
    this.spawnTimer = 0;
    this.strobeTimer = 0;
    this.flashRed = false;

    // Visual red/blue strobe light attached to scene
    this.sirenLightRed = new THREE.PointLight(0xff1122, 0, 45);
    this.sirenLightBlue = new THREE.PointLight(0x1166ff, 0, 45);
    game.scene.add(this.sirenLightRed);
    game.scene.add(this.sirenLightBlue);
  }

  addCrime(amount = 1) {
    if (this.busted) return;
    const old = this.wantedLevel;
    this.wantedLevel = clamp(this.wantedLevel + amount, 1, this.maxWanted);
    this.coolDownTimer = 16 + this.wantedLevel * 4;
    this.game.audio?.setPoliceSiren(true);
    this.game.hud?.setWanted(this.wantedLevel);

    if (old === 0) {
      this.game.hud?.toast(`WANTED · KERALA POLICE ALERT`, 3.5);
      this._spawnPoliceCar();
    }
  }

  clearWanted() {
    this.wantedLevel = 0;
    this.coolDownTimer = 0;
    this.game.audio?.setPoliceSiren(false);
    this.game.hud?.setWanted(0);
    this.sirenLightRed.intensity = 0;
    this.sirenLightBlue.intensity = 0;
    // Dismiss police
    for (const c of this.cars) {
      if (c.vehicle && c.vehicle !== this.game.player.vehicle) {
        c.vehicle.dispose();
      }
    }
    for (const off of this.officers) {
      if (off.character?.root) {
        this.game.scene.remove(off.character.root);
      }
    }
    this.cars = [];
    this.officers = [];
  }

  _spawnPoliceCar() {
    const player = this.game.player;
    if (!player) return;
    const pos = player.vehicle ? player.vehicle.pos : player.pos;
    const roads = this.game.world?.roads;
    if (!roads) return;

    // Spawn 35-50m behind or ahead on nearest road lane
    const edge = roads.nearestEdge(pos.x, pos.z, 90);
    if (!edge) return;
    const s = edge.sample;
    const spawnX = s.x - s.tx * 35;
    const spawnZ = s.z - s.tz * 35;
    const heading = Math.atan2(s.tx, s.tz);

    const v = this.game.vehicleManager.spawn('suv', spawnX, spawnZ, heading, 0xf6f6f8);
    if (!v) return;

    // Attach flashing lightbar mesh on roof
    const lightbar = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.9, 0.12, 0.25);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff1122 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x1166ff });
    const redMesh = new THREE.Mesh(barGeo, redMat);
    const blueMesh = new THREE.Mesh(barGeo, blueMat);
    redMesh.position.set(-0.45, 0, 0);
    blueMesh.position.set(0.45, 0, 0);
    lightbar.add(redMesh);
    lightbar.add(blueMesh);
    lightbar.position.set(0, 1.82, -0.2);
    v.group.add(lightbar);

    this.cars.push({
      vehicle: v,
      lightbar,
      redMat,
      blueMat,
      deployed: false,
    });
  }

  _spawnPoliceOfficer(x, z, heading) {
    const char = new Character(this.game.assets, 'xbot', {
      tint: { top: 0x1e3a68, bottom: 0x141f36, all: false }, // Kerala Police Khaki/Navy uniform
      height: 1.78,
    });
    this.game.scene.add(char.root);
    char.root.position.set(x, this.game.world.ground.height(x, z, 1), z);
    char.root.rotation.y = heading;

    this.officers.push({
      character: char,
      pos: new THREE.Vector3(x, char.root.position.y, z),
      vel: new THREE.Vector3(),
      health: 80,
      heading,
      attackCooldown: 0,
    });
  }

  update(dt) {
    if (this.busted) {
      this.bustedTimer -= dt;
      if (this.bustedTimer <= 0) {
        this.respawnPlayer();
      }
      return;
    }

    if (this.wantedLevel <= 0) {
      this.sirenLightRed.intensity = 0;
      this.sirenLightBlue.intensity = 0;
      return;
    }

    const player = this.game.player;
    if (!player) return;
    const playerPos = player.vehicle ? player.vehicle.pos : player.pos;

    // Siren strobe flash (10 Hz)
    this.strobeTimer += dt * 10;
    this.flashRed = Math.sin(this.strobeTimer * Math.PI) > 0;
    const intensity = 4.5;
    this.sirenLightRed.intensity = this.flashRed ? intensity : 0.2;
    this.sirenLightBlue.intensity = this.flashRed ? 0.2 : intensity;

    // Maintain police cars
    let nearestDist = Infinity;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const v = c.vehicle;
      if (!v || v === player.vehicle) {
        this.cars.splice(i, 1);
        continue;
      }

      // Update siren lightbar color flashes
      if (c.redMat && c.blueMat) {
        c.redMat.color.setHex(this.flashRed ? 0xff1122 : 0x440008);
        c.blueMat.color.setHex(this.flashRed ? 0x001144 : 0x1188ff);
      }

      const dx = playerPos.x - v.pos.x;
      const dz = playerPos.z - v.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);

      // Strobe lights follow nearest cop car
      this.sirenLightRed.position.set(v.pos.x - 0.5, v.pos.y + 2, v.pos.z);
      this.sirenLightBlue.position.set(v.pos.x + 0.5, v.pos.y + 2, v.pos.z);

      // Pursuit Driving AI
      const wantHeading = Math.atan2(dx, dz);
      let steerDiff = wantHeading - v.heading;
      while (steerDiff > Math.PI) steerDiff -= Math.PI * 2;
      while (steerDiff < -Math.PI) steerDiff += Math.PI * 2;
      const steer = clamp(steerDiff * 1.8, -0.65, 0.65);

      let throttle = 1.0;
      // Ram player's vehicle, or pull up close if player is on foot
      if (!player.vehicle && dist < 12) {
        throttle = 0;
        v.vf = Math.max(0, v.vf - 12 * dt);
        if (!c.deployed && dist < 9) {
          c.deployed = true;
          this._spawnPoliceOfficer(v.pos.x + Math.cos(v.heading) * 1.8, v.pos.z - Math.sin(v.heading) * 1.8, v.heading);
        }
      } else {
        throttle = clamp(dist * 0.12, 0.5, 1.2);
      }

      v.update(dt, { throttle, steer, handbrake: false });

      // Ramming damage to player vehicle
      if (player.vehicle && dist < 3.2) {
        const impactSpeed = Math.abs(v.vf - player.vehicle.vf);
        if (impactSpeed > 4) {
          player.takeDamage(Math.round(impactSpeed * 1.8));
          this.game.audio?.crash(impactSpeed);
          this.game.cameraController?.addShake(0.3);
        }
      }
    }

    // Officers pursuing on foot
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const off = this.officers[i];
      if (off.health <= 0) {
        this.game.scene.remove(off.character.root);
        this.officers.splice(i, 1);
        continue;
      }

      const dx = playerPos.x - off.pos.x;
      const dz = playerPos.z - off.pos.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);

      if (dist > 1.4) {
        // Run toward player
        off.heading = Math.atan2(dx, dz);
        const speed = 5.2;
        off.pos.x += Math.sin(off.heading) * speed * dt;
        off.pos.z += Math.cos(off.heading) * speed * dt;
        off.pos.y = this.game.world.ground.height(off.pos.x, off.pos.z, 1);
        off.character.root.position.copy(off.pos);
        off.character.root.rotation.y = off.heading;
        off.character.locomotion(speed, dt);
      } else {
        // Punch / tackle player
        off.character.locomotion(0, dt);
        off.attackCooldown -= dt;
        if (off.attackCooldown <= 0) {
          off.attackCooldown = 0.85;
          off.character.triggerPunch('right');
          this.game.audio?.punch();
          setTimeout(() => {
            if (Math.hypot(playerPos.x - off.pos.x, playerPos.z - off.pos.z) < 1.8) {
              player.takeDamage(12);
              this.game.audio?.punchHit();
            }
          }, 120);
        }
      }
      off.character.update(dt);
    }

    // Spawn reinforcements if wanted level is high and few cars active
    this.spawnTimer += dt;
    if (this.spawnTimer > 7 && this.cars.length < Math.min(3, this.wantedLevel)) {
      this.spawnTimer = 0;
      this._spawnPoliceCar();
    }

    // Evading / Cool-down timer
    if (nearestDist > 70) {
      this.coolDownTimer -= dt;
      if (this.coolDownTimer <= 0) {
        this.wantedLevel--;
        this.game.hud?.setWanted(this.wantedLevel);
        if (this.wantedLevel === 0) {
          this.clearWanted();
          this.game.hud?.toast('COPS EVADED · WANTED LEVEL LOST', 4);
        } else {
          this.coolDownTimer = 14;
        }
      }
    } else {
      this.coolDownTimer = 16 + this.wantedLevel * 4;
    }
  }

  triggerBusted(type = 'BUSTED') {
    if (this.busted) return;
    this.busted = true;
    this.bustedTimer = 3.6;
    this.game.audio?.busted();
    this.game.hud?.showBusted(type);
  }

  respawnPlayer() {
    this.busted = false;
    this.clearWanted();
    const player = this.game.player;
    if (!player) return;

    if (player.vehicle) player.exit();
    player.health = player.maxHealth;
    this.game.hud?.setHealth(player.health);
    this.game.hud?.hideBusted();

    // Respawn outside Thamarassery Police Station / Hospital
    const home = this.game.world?.city?.landmarks?.brototypeFrame;
    const spot = home ? home.P(2, 0, 14) : [209, 0, -787];
    player.teleport(spot[0], spot[2], 0);
    this.game.cameraController?.snapBehind(0);
    this.game.hud?.toast('Respawned at Thamarassery Center', 3);
  }
}
