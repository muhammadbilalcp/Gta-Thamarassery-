// Handling and presentation data per vehicle type. Speeds in m/s, accelerations in m/s^2.

export const PAINTS = [
  [0xf2f2ee, 30], // white - by far the most common colour on Kerala roads
  [0xc3c6c9, 16], // silver
  [0x6d7075, 10], // grey
  [0x16171a, 8], // black
  [0x9a1414, 9], // red
  [0x1f3f78, 7], // blue
  [0x5a3a26, 4], // brown
  [0x2f6f78, 3], // teal
  [0xb9752b, 3], // orange bronze
];

export const BIKE_PAINTS = [
  [0x16171a, 10],
  [0x9a1414, 8],
  [0x1f3f78, 6],
  [0xf2f2ee, 4],
  [0x6d7075, 5],
  [0xc8a21a, 2],
];

export const BUS_PAINTS = [
  [0x2a63b8, 8],
  [0x2e8a4f, 6],
  [0xd9d9d4, 5],
  [0x8d2230, 5],
  [0xd88418, 3],
];

export const SHIRTS = [0xf2f2ee, 0x9db7d6, 0x2f4f7a, 0xb84a3a, 0x4d7a4d, 0xd9c27a, 0x222326, 0x7a4d8a];

export const VEHICLES = {
  hatchback: {
    label: 'Hatchback',
    accel: 6.4,
    top: 41,
    brake: 15,
    reverse: 9,
    steer: 0.6,
    wheelbase: 2.45,
    grip: 10.5,
    radius: 0.86,
    camera: { dist: 6.4, height: 2.35 },
    paints: PAINTS,
    engine: { base: 62, range: 170 },
    traffic: 1.0,
  },
  sedan: {
    label: 'Sedan',
    accel: 6.0,
    top: 45,
    brake: 15,
    reverse: 9,
    steer: 0.56,
    wheelbase: 2.68,
    grip: 10.5,
    radius: 0.87,
    camera: { dist: 6.9, height: 2.35 },
    paints: PAINTS,
    engine: { base: 56, range: 160 },
    traffic: 0.98,
  },
  suv: {
    label: 'SUV',
    accel: 5.6,
    top: 43,
    brake: 14,
    reverse: 8.5,
    steer: 0.55,
    wheelbase: 2.7,
    grip: 9.5,
    radius: 0.92,
    camera: { dist: 7.2, height: 2.7 },
    paints: PAINTS,
    engine: { base: 48, range: 140 },
    traffic: 0.98,
  },
  auto: {
    label: 'Auto Rickshaw',
    accel: 3.0,
    top: 17.5,
    brake: 9,
    reverse: 4,
    steer: 0.7,
    wheelbase: 1.85,
    grip: 8,
    radius: 0.68,
    camera: { dist: 5.2, height: 2.3 },
    paints: [[0x141414, 1]],
    engine: { base: 85, range: 210, rough: true },
    traffic: 0.72,
  },
  ksrtc: {
    label: 'KSRTC Bus',
    accel: 2.6,
    top: 25,
    brake: 9,
    reverse: 4,
    steer: 0.52,
    wheelbase: 5.7,
    grip: 8,
    radius: 1.28,
    camera: { dist: 12.5, height: 4.6 },
    paints: [[0xffffff, 1]],
    engine: { base: 34, range: 90, rough: true },
    traffic: 0.8,
    heavy: true,
  },
  bus: {
    label: 'Private Bus',
    accel: 2.9,
    top: 27,
    brake: 9,
    reverse: 4,
    steer: 0.52,
    wheelbase: 5.7,
    grip: 8,
    radius: 1.28,
    camera: { dist: 12.5, height: 4.6 },
    paints: BUS_PAINTS,
    engine: { base: 36, range: 95, rough: true },
    traffic: 0.88,
    heavy: true,
  },
  motorcycle: {
    label: 'Motorcycle',
    accel: 7.4,
    top: 38,
    brake: 13,
    reverse: 2,
    steer: 0.55,
    wheelbase: 1.36,
    grip: 9,
    radius: 0.42,
    camera: { dist: 5.0, height: 2.0 },
    paints: BIKE_PAINTS,
    engine: { base: 95, range: 260 },
    traffic: 1.02,
    lean: 0.62,
  },
  scooter: {
    label: 'Scooter',
    accel: 4.6,
    top: 25,
    brake: 11,
    reverse: 2,
    steer: 0.6,
    wheelbase: 1.22,
    grip: 8.5,
    radius: 0.4,
    camera: { dist: 4.8, height: 2.0 },
    paints: BIKE_PAINTS,
    engine: { base: 105, range: 230 },
    traffic: 0.85,
    lean: 0.5,
  },
};

// What the traffic system spawns and how often.
export const TRAFFIC_MIX = [
  ['hatchback', 22],
  ['sedan', 12],
  ['suv', 12],
  ['auto', 16],
  ['scooter_r', 15],
  ['motorcycle_r', 14],
  ['bus', 5],
  ['ksrtc', 4],
];

export const baseType = (t) => t.replace(/_r$/, '');
