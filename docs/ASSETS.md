# Assets and licences

Everything that ships in `public/assets` is free to use. Nothing was taken from Google
Maps / Street View or any other restricted source - those were consulted as *reference*
only (see `RESEARCH.md`).

| Asset | Files | Source | Licence |
| --- | --- | --- | --- |
| Sky HDRI "Kloofendal 38d Partly Cloudy (Pure Sky)" | `hdri/sky_4k.hdr`, `hdri/sky_2k.hdr` | [Poly Haven](https://polyhaven.com/a/kloofendal_38d_partly_cloudy_puresky) | CC0 |
| PBR textures: asphalt_02, interlocking_concrete_pavers, concrete_pavers_02, concrete_wall_008, leafy_grass, red_laterite_soil_stones, brown_mud_leaves_01, clay_roof_tiles_02, painted_plaster_wall, worn_mossy_plasterwall, corrugated_iron_02 | `textures/*_diff.jpg`, `*_nor.jpg`, `*_rough.jpg` | [Poly Haven](https://polyhaven.com/textures) | CC0 |
| Water normal map | `textures/waternormals.jpg` | three.js examples | MIT |
| Player / pedestrian rigs and the idle, walk and run cycles | `models/readyplayer.me.glb`, `models/Michelle.glb`, `models/Xbot.glb` | [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf) (Ready Player Me sample avatar, Mixamo characters) | Demo assets distributed with three.js; replace them before any commercial release |
| Fonts: Anek Malayalam, Noto Sans Malayalam, Noto Sans Devanagari | `fonts/*.woff2` | [Fontsource](https://fontsource.org) / Google Fonts | SIL Open Font Licence 1.1 |
| Road, metro and landmark positions | (baked into `src/world/layout.js`) | [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors | ODbL |

## Generated in code (no external asset)

* All vehicles (hatchback, sedan, SUV, auto rickshaw, KSRTC and private buses, motorcycle,
  scooter, metro train) - `src/entities/vehicles`, `src/world/Metro.js`
* All buildings, facades, shopfronts, hoardings and signboards - `src/world`
* Coconut palms, trees, banana plants, shrubs - `src/world/Vegetation.js`
* All audio (engine, horns, city bed, birds, crows) - `src/core/AudioManager.js`

## Names and brands

LuLu, Forum, Marriott, Crowne Plaza, KSRTC, Kochi Metro and Brototype appear because the
brief asks for recognisable real places. They are the property of their owners; this is a
non-commercial fan prototype. Shop names and advertising hoardings are invented.
