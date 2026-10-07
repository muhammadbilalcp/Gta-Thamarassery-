// Quality presets. `?q=low|medium|high` in the URL overrides the automatic choice.

const dpr = Math.min(window.devicePixelRatio || 1, 2);

export const PRESETS = {
  high: {
    name: 'high',
    pixelRatio: Math.min(dpr, 1.5),
    msaa: 4,
    shadowSize: 4096,
    shadowRange: 125,
    sky4k: true,
    bloom: true,
    dynamicResolution: true,
    traffic: 92,
    pedestrians: 26,
    parked: 1,
    vegetation: 1,
    drawDistance: 2300,
  },
  medium: {
    name: 'medium',
    pixelRatio: Math.min(dpr, 1.25),
    msaa: 2,
    shadowSize: 2048,
    shadowRange: 105,
    sky4k: false,
    bloom: true,
    dynamicResolution: true,
    traffic: 64,
    pedestrians: 18,
    parked: 0.8,
    vegetation: 0.75,
    drawDistance: 2000,
  },
  low: {
    name: 'low',
    pixelRatio: 1,
    msaa: 0,
    shadowSize: 1024,
    shadowRange: 80,
    sky4k: false,
    bloom: false,
    dynamicResolution: true,
    traffic: 38,
    pedestrians: 10,
    parked: 0.6,
    vegetation: 0.5,
    drawDistance: 1600,
  },
};

export function chooseQuality() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (q && PRESETS[q]) return { ...PRESETS[q] };
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (cores <= 4 || mem <= 4) return { ...PRESETS.medium };
  return { ...PRESETS.high };
}
