// Assembles the static world in stages so the loading screen can report progress.

import { Terrain } from './Terrain.js';
import { SurfaceMap, SURF } from './SurfaceMap.js';
import { RoadNetwork } from './RoadNetwork.js';
import { RoadMeshBuilder } from './RoadMeshBuilder.js';
import { Ground } from './Ground.js';
import { Land } from './Land.js';
import { Environment } from './Environment.js';
import { Metro } from './Metro.js';
import { CityBuilder } from './CityBuilder.js';
import { Vegetation } from './Vegetation.js';
import { Culler } from './Culler.js';
import { CollisionWorld } from '../core/Collision.js';
import { RESERVED, RESERVED_CIRCLES, OPEN_AREAS } from './layout.js';

export class World {
  constructor(scene, renderer, assets, quality, game) {
    this.game = game;
    this.scene = scene;
    this.renderer = renderer;
    this.assets = assets;
    this.quality = quality;
    this.updaters = [];
  }

  /** Yields [label, fn] build steps. */
  *steps() {
    yield ['Surveying the backwaters', () => {
      this.terrain = new Terrain();
      this.surface = new SurfaceMap(this.terrain);
      this.colliders = new CollisionWorld();
      for (const r of RESERVED) this.surface.rect(r.c[0], r.c[1], r.hx, r.hz, r.rot, SURF.RESERVED);
      for (const c of RESERVED_CIRCLES) this.surface.circle(c.c[0], c.c[1], c.r, SURF.RESERVED);
      for (const poly of OPEN_AREAS) {
        for (let i = 1; i < poly.length - 1; i++) this.surface.tri(poly[0][0], poly[0][1], poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1], SURF.OPEN, [SURF.RESERVED]);
      }
    }];
    yield ['Laying out NH 66', () => {
      this.roads = new RoadNetwork();
      this.ground = new Ground(this.surface, this.roads, this.terrain);
      this.metro = new Metro(this);
    }];
    yield ['Painting facades and signboards', () => {
      this.city = new CityBuilder(this);
      this.city.prepare();
    }];
    yield ['Pouring asphalt and flyovers', () => {
      this.roadBuilder = new RoadMeshBuilder(this);
      this.scene.add(this.roadBuilder.build());
    }];
    yield ['Lighting a Thamarassery afternoon', () => {
      this.environment = new Environment(this.scene, this.renderer, this.assets, this.quality);
      this.land = new Land(this.scene, this.assets, this.terrain);
      this.updaters.push((dt) => this.land.update(dt));
    }];
    yield ['Raising the metro viaduct', () => {
      this.metro.reserve();
      this.scene.add(this.metro.build());
      this.updaters.push((dt, focus) => this.metro.update(dt, focus));
    }];
    yield ['Building landmarks', () => {
      this.city.landmarks.build();
    }];
    yield ['Building the city', () => {
      this.city._frontages();
      this.city._interior();
      this.city.props.build();
      this.scene.add(this.city.finish());
      this.time = 0;
      this.updaters.push((dt) => {
        this.time += dt;
        this.city.props.update(this.time);
      });
    }];
    yield ['Planting coconut palms', () => {
      this.vegetation = new Vegetation(this);
      this.scene.add(this.vegetation.build());
      this.updaters.push((dt) => this.vegetation.update(dt));
    }];
    yield ['Tidying up', () => {
      this.culler = new Culler(this);
      this.updaters.push((dt, focus, camera) => this.culler.update(dt, camera));
    }];
  }

  /** Extra setback for lots on a side of the road where the viaduct runs beside it. */
  metroClearance(edge, side, s) {
    const f = edge.at(s);
    const lat = side * (edge.half + edge.walk + 5);
    const t = this.surface.typeAt(f.x + f.nx * lat, f.z + f.nz * lat);
    return t === SURF.RESERVED ? 13.5 : 0;
  }

  /** Called once the vehicle systems exist: parked vehicles, traffic, pedestrians. */
  async populate(game) {
    const vm = game.vehicleManager;
    // A car, a bike and an auto wait right outside Brototype.
    const fr = this.city.landmarks.brototypeFrame;
    const place = (type, lx, lz, turn, colour) => {
      const p = fr.P(lx, 0, lz);
      return vm.spawn(type, p[0], p[2], Math.atan2(fr.fx, fr.fz) + turn, colour);
    };
    place('hatchback', -6, 24.5, Math.PI / 2, 0x9a1414);
    place('motorcycle', 1.5, 22.5, Math.PI / 2, 0x16171a);
    place('auto', 9, 25, Math.PI / 2);
    vm.setParking(this.city.parking, 0.42 * (this.quality.parked ?? 1));
  }

  roadNameAt(x, z) {
    const hit = this.roads.nearestEdge(x, z, 30);
    if (!hit) return '';
    if (Math.abs(hit.lateral) > hit.edge.half + hit.edge.walk + 4) return '';
    return hit.edge.name;
  }

  update(dt, focus, camera) {
    for (const u of this.updaters) u(dt, focus, camera);
    this.environment.update(focus);
  }
}
