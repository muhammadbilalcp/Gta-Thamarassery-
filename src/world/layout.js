// Thamarassery & Kozhikode (NH 766 / Wayanad Road Corridor).
//
// World axes: +X = east, -Z = north, +Y = up. Units are metres.
// Layout is authored as (east, north) and converted with P().

export const P = (east, north) => [east, -north];

export const WORLD = {
  minX: -1620,
  maxX: 920,
  minZ: -2280, // north edge (toward Wayanad Churam)
  maxZ: 1680, // south edge (toward Kozhikode City)
};

// The part of the world that is filled in densely. Beyond it only the road corridors that
// lead out of town are built, fading into the haze.
export const CORE = {
  minX: -1330,
  maxX: 670,
  minZ: -2030,
  maxZ: 1410,
};

// The player is turned around this far before a road actually ends.
export const EXIT_BUFFER = 285;

export const ROAD_CLASSES = {
  // NH 766 Wayanad Road corridor. The two inner lanes per direction climb on to the flyovers,
  // the two outer lanes stay on the ground and feed the junctions.
  highway: {
    lanes: 4,
    laneWidth: 3.3,
    median: 1.8,
    separatorAfter: 2,
    separator: 1.0,
    shoulder: 0.4,
    sidewalk: 2.6,
    speed: 20,
  },
  arterial: {
    lanes: 2,
    laneWidth: 3.3,
    median: 1.8,
    separatorAfter: -1,
    separator: 0,
    shoulder: 0.4,
    sidewalk: 2.4,
    speed: 14.5,
  },
  street: {
    lanes: 1,
    laneWidth: 3.5,
    median: 0,
    separatorAfter: -1,
    separator: 0,
    shoulder: 0.3,
    sidewalk: 1.8,
    speed: 10,
  },
};

/** Lateral offset of the centre of lane `i` (0 = next to the median). */
export function laneOffset(cls, i) {
  const c = ROAD_CLASSES[cls];
  let o = c.median / 2 + (i + 0.5) * c.laneWidth;
  if (c.separatorAfter > 0 && i >= c.separatorAfter) o += c.separator;
  return o;
}

/** Half width of the asphalt (without sidewalks). */
export function carriageHalf(cls) {
  const c = ROAD_CLASSES[cls];
  return c.median / 2 + c.lanes * c.laneWidth + (c.separatorAfter > 0 ? c.separator : 0) + c.shoulder;
}

export const FLYOVER_DECK_HALF = 8.0; // inner lanes + parapets

export const NODES = {
  // --- NH 766 Wayanad Road spine, south (Kozhikode) to north (Wayanad Churam) --------
  S_EDGE: { p: P(135, -1620), exit: true, toward: 'Kozhikode · Calicut Beach' },
  K: { p: P(40, -850), name: 'Karadi Jn', signal: true },
  V: { p: P(0, 0), name: 'Chungam Jn', signal: true },
  SLJ: { p: P(-85, 470), name: 'Old Bus Stand', signal: true },
  PB: { p: P(-150, 850), name: 'KSRTC Depot Jn', signal: true },
  E: { p: P(-320, 1400), name: 'Churam Gateway', signal: true },
  NW_EDGE: { p: P(-845, 2200), exit: true, toward: 'Balussery · Koyilandy' },
  NE_EDGE: { p: P(90, 2215), exit: true, toward: 'Wayanad · Kalpetta · Sulthan Bathery' },
  // --- Thamarassery - Engapuzha Road ------------------------------------------------
  CP: { p: P(-505, 1125), name: 'Puduppadi' },
  P: { p: P(-445, 880), name: 'Engapuzha Jn', signal: true },
  S: { p: P(-680, 765), name: 'Stadium Jn', signal: true },
  KL: { p: P(-960, 620), name: 'Koduvally Jn', signal: true },
  W_EDGE_N: { p: P(-1540, 395), exit: true, toward: 'Kozhikode City · Mavoor Road' },
  // --- Koduvally - Kunnamangalam ---------------------------------------------------
  KD: { p: P(-840, -40), name: 'Kunnamangalam Jn', signal: true },
  W_EDGE_S: { p: P(-1560, -127), exit: true, toward: 'Kozhikode Railway Station' },
  // --- other exits ------------------------------------------------------------------
  E_EDGE_C: { p: P(577, 948), exit: true, toward: 'Adivaram · Churam 9 Hairpin Bends' },
  SE_EDGE: { p: P(820, -745), exit: true, toward: 'Mukkam · Manjeri' },
  W_EDGE_K: { p: P(-840, -1028), exit: true, toward: 'Karanthur · Kunnamangalam' },
  E_EDGE_K: { p: P(880, -612), exit: true, toward: 'Kaithapoyil' },
};

export const EDGES = [
  { id: 'NH66_1', a: 'S_EDGE', b: 'K', cls: 'highway', name: 'Wayanad Road (NH 766)', via: [P(100, -1340), P(75, -1100)] },
  { id: 'NH66_2', a: 'K', b: 'V', cls: 'highway', name: 'Wayanad Road (NH 766)', via: [P(28, -560), P(14, -300)] },
  { id: 'NH66_3', a: 'V', b: 'SLJ', cls: 'highway', name: 'Wayanad Road (NH 766)', via: [P(-22, 220)] },
  { id: 'NH66_4', a: 'SLJ', b: 'PB', cls: 'highway', name: 'Wayanad Road (NH 766)', via: [P(-118, 660)] },
  { id: 'NH66_5', a: 'PB', b: 'E', cls: 'highway', name: 'Wayanad Road (NH 766)', via: [P(-205, 1080), P(-275, 1270)] },
  { id: 'NH66_6', a: 'E', b: 'NW_EDGE', cls: 'arterial', name: 'Thamarassery - Balussery Road', via: [P(-455, 1560), P(-585, 1770), P(-700, 1960)] },
  { id: 'NH544', a: 'E', b: 'NE_EDGE', cls: 'highway', name: 'Wayanad Churam Ghat Road', via: [P(-225, 1570), P(-110, 1790), P(-30, 1960)] },
  { id: 'ONH47', a: 'CP', b: 'E', cls: 'highway', name: 'Thamarassery Churam Pass', via: [P(-420, 1255)] },
  { id: 'BAN_1', a: 'P', b: 'CP', cls: 'arterial', name: 'Thamarassery - Engapuzha Road', via: [P(-492, 1000)], metro: true },
  { id: 'BAN_2', a: 'S', b: 'P', cls: 'arterial', name: 'Thamarassery Main Road', via: [P(-560, 815)], metro: true },
  { id: 'BAN_3', a: 'KL', b: 'S', cls: 'arterial', name: 'Koduvally - Thamarassery Road', via: [P(-820, 695)], metro: true },
  { id: 'BAN_4', a: 'W_EDGE_N', b: 'KL', cls: 'arterial', name: 'Calicut - Wayanad Highway', via: [P(-1280, 500), P(-1120, 565)], metro: true },
  { id: 'CIVIL_1', a: 'P', b: 'PB', cls: 'arterial', name: 'KSRTC Depot Road', via: [P(-300, 858)] },
  { id: 'CIVIL_2', a: 'PB', b: 'E_EDGE_C', cls: 'arterial', name: 'Adivaram Churam Road', via: [P(60, 868), P(300, 905)] },
  { id: 'KK', a: 'KL', b: 'KD', cls: 'street', name: 'Koduvally - Kunnamangalam Rd', via: [P(-955, 420), P(-915, 180)] },
  { id: 'SA_1', a: 'W_EDGE_S', b: 'KD', cls: 'arterial', name: 'Calicut Highway', via: [P(-1280, -95), P(-1060, -70)], metro: true },
  { id: 'SA_2', a: 'KD', b: 'V', cls: 'arterial', name: 'Calicut - Thamarassery Road', via: [P(-620, -18), P(-400, -28), P(-190, -8)], metro: true },
  { id: 'TRP', a: 'V', b: 'SE_EDGE', cls: 'arterial', name: 'Thamarassery - Mukkam Road', via: [P(150, -30), P(300, -245), P(450, -420), P(610, -560)] },
  { id: 'KUN_W', a: 'W_EDGE_K', b: 'K', cls: 'arterial', name: 'Karadi - Kunnamangalam Road', via: [P(-560, -985), P(-300, -945), P(-110, -890)] },
  { id: 'KUN_E', a: 'K', b: 'E_EDGE_K', cls: 'arterial', name: 'Karadi - Kaithapoyil Road', via: [P(215, -808), P(420, -745), P(610, -690)] },
  {
    id: 'STAD',
    a: 'S',
    b: 'SLJ',
    cls: 'arterial',
    name: 'Stadium Bypass Link',
    via: [P(-752, 680), P(-770, 560), P(-715, 455), P(-600, 418), P(-400, 438), P(-230, 462)],
  },
];

// Flyovers ride on the inner lanes of the two edges that meet at `node`.
export const FLYOVERS = [
  { id: 'F_K', name: 'Karadi Flyover', node: 'K', edges: ['NH66_1', 'NH66_2'], half: 150, flat: 42, height: 6.4 },
  { id: 'F_V', name: 'Chungam Flyover', node: 'V', edges: ['NH66_2', 'NH66_3'], half: 150, flat: 42, height: 6.4 },
  { id: 'F_PB', name: 'KSRTC Depot Flyover', node: 'PB', edges: ['NH66_4', 'NH66_5'], half: 145, flat: 40, height: 6.2 },
  { id: 'F_E', name: 'Churam Gateway Flyover', node: 'E', edges: ['ONH47', 'NH544'], half: 150, flat: 46, height: 6.4 },
];

export const METRO = {
  railHeight: 13.2,
  deckHalf: 4.6,
  pillarSpacing: 27,
  lines: [
    {
      id: 'north',
      pieces: [
        { pts: [P(190, 2420), P(140, 2320)] },
        { edge: 'NH544', dir: -1, side: 1, offset: 22.5 },
        { edge: 'ONH47', dir: -1, side: 1, offset: 22.5, to: 235 },
        { pts: [P(-470, 1188)] },
        { edge: 'BAN_1', dir: -1, from: 55 },
        { edge: 'BAN_2', dir: -1 },
        { edge: 'BAN_3', dir: -1 },
        { edge: 'BAN_4', dir: -1 },
        { pts: [P(-1700, 330)] },
      ],
      stations: [
        { name: 'Churam Gateway', ml: 'ചുരം കവാടം', near: P(-300, 1455) },
        { name: 'Puduppadi', ml: 'പുതുപ്പാടി', near: P(-498, 1060) },
        { name: 'Engapuzha', ml: 'ഈങ്ങാപ്പുഴ', near: P(-520, 845) },
        { name: 'Thamarassery Stadium', ml: 'സ്റ്റേഡിയം', near: P(-745, 732) },
        { name: 'Koduvally', ml: 'കൊടുവള്ളി', near: P(-1040, 592) },
      ],
    },
    {
      id: 'south',
      pieces: [
        { pts: [P(-1720, -146)] },
        { edge: 'SA_1', dir: 1 },
        { edge: 'SA_2', dir: 1 },
        { pts: [P(60, 12), P(135, 30), P(215, 8), P(268, -70), P(298, -170)] },
        { edge: 'TRP', dir: 1, from: 345 },
        { pts: [P(960, -870)] },
      ],
      stations: [
        { name: 'Kunnamangalam', ml: 'കുന്നമംഗലം', near: P(-760, -32) },
        { name: 'Old Bus Stand', ml: 'പഴയ ബസ് സ്റ്റാൻഡ്', near: P(-400, -28) },
        { name: 'Chungam', ml: 'ചുങ്കം', near: P(140, 30) },
        { name: 'Karadi', ml: 'കാരടി', near: P(405, -365) },
      ],
    },
  ],
};

// Water. Polygons are filled, channels are polylines with a width.
export const WATER = {
  level: -0.9,
  polygons: [
    [P(-1800, -600), P(-700, -640), P(-420, -700), P(-250, -760), P(-170, -930), P(-150, -1060), P(-60, -1130), P(-40, -1900), P(-1800, -1900)],
    [P(392, 330), P(440, 250), P(452, 90), P(430, -40), P(470, -150), P(560, -215), P(1100, -270), P(1100, -120), P(560, -95), P(520, 40), P(540, 250), P(500, 360)],
  ],
  channels: [
    { pts: [P(-60, -1180), P(90, -1165), P(260, -1200), P(1100, -1290)], width: 95 },
    { pts: [P(-330, -700), P(-160, -470), P(20, -425), P(200, -440), P(360, -330), P(470, -170)], width: 34 },
    { pts: [P(-1800, 1100), P(-900, 1060), P(-640, 1010), P(-330, 1090), P(-120, 1060), P(140, 1120), P(1100, 1080)], width: 17 },
  ],
};

// Landmark anchor points.
export const LANDMARKS = {
  lulu: { p: P(-338, 1662), rot: 0, name: 'Thamarassery Churam Mall' },
  forum: { p: P(-78, -652), rot: 0, name: 'Chungam Junction' },
  stadium: { p: P(-612, 582), rot: 0, name: 'Thamarassery Stadium' },
  hub: { p: P(250, 150), rot: -Math.PI / 2, name: 'KSRTC Thamarassery Depot' },
  brototype: { p: P(212, -768), rot: -Math.PI / 2, name: 'Thamarassery Hub' },
  crowne: { p: P(150, -945), rot: Math.PI, name: 'Churam Valley Resort' },
};

export const RESERVED = [
  { c: P(-338, 1662), hx: 78, hz: 125, rot: 0, tag: 'lulu' },
  { c: P(-345, 1840), hx: 45, hz: 45, rot: 0, tag: 'marriott' },
  { c: P(-78, -652), hx: 78, hz: 62, rot: 0, tag: 'forum' },
  { c: P(250, 150), hx: 118, hz: 135, rot: 0, tag: 'hub' },
  { c: P(212, -768), hx: 26, hz: 22, rot: 0.26, tag: 'brototype' },
  { c: P(150, -945), hx: 48, hz: 48, rot: 0, tag: 'crowne' },
];
export const RESERVED_CIRCLES = [{ c: P(-612, 582), r: 128, tag: 'stadium' }];

export const OPEN_AREAS = [
  [P(-262, 1540), P(-236, 1548), P(-132, 1752), P(-150, 1800), P(-262, 1800)],
  [P(-420, 1752), P(-262, 1752), P(-262, 1800), P(-420, 1800)],
  [P(-2, -720), P(14, -720), P(10, -590), P(-2, -590)],
  [P(132, 0), P(250, -12), P(250, 20), P(132, 22)],
];

// Named districts in Kozhikode / Thamarassery for the HUD banner.
export const ZONES = [
  { name: 'THAMARASSERY CHUNGAM', ml: 'താമരശ്ശേരി ചുങ്കം', p: P(0, 0), r: 300 },
  { name: 'KARADI', ml: 'കാരടി', p: P(40, -850), r: 260 },
  { name: 'OLD BUS STAND', ml: 'പഴയ ബസ് സ്റ്റാൻഡ്', p: P(-85, 470), r: 210 },
  { name: 'KSRTC DEPOT', ml: 'കെ.എസ്.ആർ.ടി.സി ഡിപ്പോ', p: P(250, 150), r: 260 },
  { name: 'KODUVALLY', ml: 'കൊടുവള്ളി', p: P(-960, 620), r: 330 },
  { name: 'KUNNAMANGALAM', ml: 'കുന്നമംഗലം', p: P(-840, -40), r: 280 },
  { name: 'ENGAPUZHA', ml: 'ഈങ്ങാപ്പുഴ', p: P(-445, 880), r: 300 },
  { name: 'KAITHAPOYIL', ml: 'കൈതപ്പൊയിൽ', p: P(400, -760), r: 240 },
  { name: 'PUDUPPADI', ml: 'പുതുപ്പാടി', p: P(-505, 1125), r: 170 },
  { name: 'ADIVARAM', ml: 'അടിവാരം', p: P(90, -1260), r: 200 },
  { name: 'CHURAM PASS', ml: 'താമരശ്ശേരി ചുരം', p: P(-320, 1400), r: 420 },
  { name: 'CALICUT HIGHWAY', ml: 'കോഴിക്കോട് ഹൈവേ', p: P(-420, -30), r: 230 },
];

export const SPAWN = { p: P(209, -787), heading: 0.22 };

// Trilingual names used on the green NHAI place boards.
export const PLACE_NAMES = {
  K: { en: 'KARADI', ml: 'കാരടി', hi: 'कराडी' },
  V: { en: 'CHUNGAM', ml: 'ചുങ്കം', hi: 'चुंगम' },
  PB: { en: 'KSRTC DEPOT', ml: 'കെ.എസ്.ആർ.ടി.സി', hi: 'केएसआरटीसी' },
  P: { en: 'ENGAPUZHA', ml: 'ഈങ്ങാപ്പുഴ', hi: 'इंगाप्पुझा' },
  E: { en: 'CHURAM PASS', ml: 'താമരശ്ശേരി ചുരം', hi: 'तामरश्शेरी चुरम' },
  KL: { en: 'KODUVALLY', ml: 'കൊടുവള്ളി', hi: 'कोडवल्ली' },
  S: { en: 'STADIUM', ml: 'സ്റ്റേഡിയം', hi: 'स्टेडियम' },
  KD: { en: 'KUNNAMANGALAM', ml: 'കുന്നമംഗലം', hi: 'कुन्नमंगलम' },
  SLJ: { en: 'OLD BUS STAND', ml: 'പഴയ ബസ് സ്റ്റാൻഡ്', hi: 'ओल्ड बस स्टैंड' },
  CP: { en: 'PUDUPPADI', ml: 'പുതുപ്പാടി', hi: 'पुदुप्पाडी' },
};
