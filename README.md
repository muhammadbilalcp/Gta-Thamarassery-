# GTA Thamarassery — Kozhikode Open World (React + Three.js)

A GTA-style, third-person, playable 3D open world of **Thamarassery, Kozhikode (Calicut), Kerala**, built with React and Three.js.
Walk, run and jump around the town, get into any vehicle and drive the **Wayanad Road (NH 766)** corridor from
Karadi and Chungam Junction through Old Bus Stand, KSRTC Depot, Engapuzha, and Puduppadi up toward the famous **Thamarassery Churam** (Wayanad Ghat Pass).

## Mobile & Desktop Controls

The game now features full **on-screen mobile touch controls** as well as keyboard/mouse support:

### Mobile Touch Controls
- **Virtual Analog Joystick** (bottom-left): Smooth 360-degree walking, running, vehicle throttle & steering.
- **Swipe Look Zone** (right half of screen): Drag to rotate camera and look around naturally.
- **Action Buttons**:
  - **On foot**:
    - 🚗 **ENTER / RIDE**: Contextual vehicle boarding (glows when next to vehicles)
    - ⬆ **JUMP**: Leap over kerbs and barriers
    - 👟 **RUN**: Toggle sprint on/off
    - 🗺 **MAP**: Fullscreen landmark map
    - ⚡ **TRAVEL**: Cycle fast travel across Thamarassery
  - **In vehicle**:
    - 🟢 **GAS**: Forward acceleration
    - 🔴 **BRAKE**: Brake & reverse
    - 🛑 **DRIFT**: Handbrake for sharp drifting
    - 📢 **HORN**: Kerala traffic horn
    - 🚪 **EXIT**: Step out of car
    - 🔄 **RESET**: Reset vehicle upright on road
    - 🗺 **MAP** & ⚡ **TRAVEL**
- **Touch ON/OFF Toggle** in the top right to switch touch overlay anytime.

### Desktop Keyboard & Mouse

| On foot | | Driving | |
| --- | --- | --- | --- |
| `W A S D` | move | `W` | accelerate |
| `Shift` | run | `S` | brake / reverse |
| `Space` | jump | `A` `D` | steer |
| `Mouse` | look | `Space` | handbrake |
| `E` | get in | `E` | get out (slow down first) |
| | | `H` | horn |
| | | `R` | reset vehicle onto the road |

`M` big map (click a landmark to fast travel) · `T` cycle fast travel · `F1` hide the
controls panel · mouse wheel zooms the camera.

## Thamarassery & Kozhikode Landmarks & Zones

- **Thamarassery Chungam (താമരശ്ശേരി ചുങ്കം)** — the bustling junction connecting Wayanad and Balussery
- **Thamarassery Churam Pass (താമരശ്ശേരി ചുരം)** — the iconic mountain pass gateway with 9 hairpin bends
- **KSRTC Thamarassery Depot (കെ.എസ്.ആർ.ടി.സി ഡിപ്പോ)** — with bus bays and KSRTC buses
- **Thamarassery Stadium (താമരശ്ശേരി സ്റ്റേഡിയം)** — open grounds and stadium
- **Karadi, Old Bus Stand, Engapuzha, Puduppadi, Koduvally, Kunnamangalam, Adivaram**
- Authentic Malabar & Calicut shops, tea shops, biriyani houses, and bakeries

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Production build: `npm run build` then `npm run preview`.
