# Kochi — Miniature Open World

A GTA-style, third-person, playable miniature of Kochi, Kerala, built with Three.js.
Walk, run and jump around the city, get into any vehicle and drive the NH 66 corridor from
Kundannoor through Vyttila and Palarivattom to Edappally, with Kaloor and the stadium to
the west.

The real corridor is about 11 km × 4 km. The miniature squeezes it into roughly
3 km × 2 km while keeping the geography a Kochiite would expect: which side of the highway
a landmark stands on, where the flyovers are, where the metro leaves the road.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Production build: `npm run build` then `npm run preview`.

URL options: `?q=low|medium|high` picks a quality preset, `?autostart` skips the
"click to play" button.

## Controls

| On foot | | Driving | |
| --- | --- | --- | --- |
| `W A S D` | move | `W` | accelerate |
| `Shift` | run | `S` | brake / reverse |
| `Space` | jump | `A` `D` | steer |
| Mouse | look | `Space` | handbrake |
| `E` | get in | `E` | get out (slow down first) |
| | | `H` | horn |
| | | `R` | reset vehicle onto the road |

`M` big map (click a landmark to fast travel) · `T` cycle fast travel · `F1` hide the
controls panel · mouse wheel zooms the camera.

Any parked vehicle can be taken, and so can traffic that is stopped or crawling.

## What is in the world

**Landmarks** (modelled from reference photographs, positioned from OpenStreetMap)

* **LuLu Mall, Edappally** — sandstone block, glass atrium with the white tensile roof,
  multi-level car park, the Kochi Marriott behind it and the skywalk from the metro station
* **Forum Kochi, Maradu** — white fins over green/yellow leaf panels, LED screens, rooftop
  lettering, the hotel block beside it
* **Jawaharlal Nehru International Stadium, Kaloor** — three tiers, folded-plate terracotta
  roof, four giant floodlight pylons, shops in the outer ring; the gates are open, walk in
* **Vyttila Mobility Hub** — the row of shell canopies with lattice skylights, bus bays
  with KSRTC and private buses, the Water Metro jetty on the Kaniyampuzha
* **Brototype Kochi Hub, Kundannoor** — where you start
* **Kundannoor Junction** with its flyover, Crowne Plaza and the bridges over the backwater
* Flyovers at **Kundannoor, Vyttila, Palarivattom and Edappally**; at Vyttila the metro
  crosses above the flyover, three levels deep
* **Kochi Metro** — viaduct, nine stations with Malayalam / English name boards, turquoise
  three-car trains that call at each station

**Street life**

* Left-hand traffic: hatchbacks, sedans, SUVs, auto rickshaws, scooters, motorcycles, KSRTC
  and private buses. They follow lanes, keep their distance, obey the signals, filter left
  and honk when held up
* Pedestrians on the footpaths and zebra crossings
* Malayalam and English shop boards, green trilingual NHAI place boards, direction
  gantries, hoardings, bus shelters, utility poles and wires, black-and-yellow kerbs
* Coconut palms, rain trees, banana clumps, bougainvillea in the medians, backwaters

## Project layout

```
src/
  main.js, Game.js          bootstrap, main loop, enter / exit, fast travel
  core/
    Assets.js               texture / model / font loading, NPC mesh simplification
    RenderPipeline.js       renderer, MSAA + bloom + grade, dynamic resolution
    Input.js                keyboard, pointer lock mouse
    CameraController.js     orbit camera on foot, chase camera in vehicles, collision
    Collision.js            static collision world (boxes / cylinders in a grid)
    AudioManager.js         fully synthesised audio
    Quality.js              presets
  world/
    layout.js               the compressed map: nodes, roads, flyovers, metro, water, zones
    RoadNetwork.js          centrelines, junction trimming, lanes, signals, sidewalk graph
    RoadMeshBuilder.js      carriageways, kerbs, flyovers, bridges, markings
    RoadTextures.js         painted asphalt textures
    Terrain.js, Land.js     height field, ground and water
    SurfaceMap.js           1 m raster of what the ground is (physics, placement, map)
    Ground.js               "what am I standing on", including flyover decks
    CityBuilder.js          procedural buildings along roads and inside blocks
    FacadeTextures.js       facades, shopfronts, hoardings
    landmarks/              hand-built places and the sign sheets
    Props.js                street lights, signals, sign boards, shelters, wires
    Metro.js                viaduct, stations, trains
    Vegetation.js           instanced plants with wind and LOD
    Environment.js          sky, sun, fog, shadows
    Culler.js               distance culling and LOD switching
  entities/
    Player.js, Character.js character controller, animation retargeting
    Vehicle.js              arcade driving model
    VehicleManager.js       parked and abandoned vehicles
    Traffic.js              lane-following traffic
    Pedestrians.js          footpath walkers
    vehicles/               procedural vehicle models, atlas, instanced renderer
  ui/HUD.js                 minimap, speedometer, prompts, district banner, big map
  utils/                    math, RNG, mesh builder, texture arrays, canvas helpers
docs/
  RESEARCH.md               coordinates and visual references used
  ASSETS.md                 every external asset and its licence
```

## How it is put together

* **One material for the city.** Facades, shopfronts, signs, roofs, kerbs, the metro and
  the landmarks are packed into WebGL2 texture arrays (`utils/LayerAtlas.js`), so a whole
  world cell is a single draw call regardless of how many building styles are in it.
* **Instancing.** Vehicles are drawn per body type with per-instance paint and brake
  lights; only vehicles the camera can see are written to the instance buffers. Vegetation
  is instanced per cell with a lighter model in the distance.
* **Layered ground.** A 1 m surface raster gives road / footpath / median heights; flyover
  decks are analytic surfaces on top, picked by the height of whoever is asking, so you can
  drive over the junction or under it.
* **Performance.** Around 250–350 draw calls and 1–1.7 M triangles per frame including
  the shadow pass. Resolution scales itself down if the frame rate drops.

## Notes

* Pointer lock is requested when you click the game; press `Esc` to release the mouse.
* Audio starts after the first click (browser policy).
* Real-world names appear because the brief asks for recognisable places; see
  `docs/ASSETS.md`.
