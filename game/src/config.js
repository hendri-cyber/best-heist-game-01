// COLD AISLE — a data-center heist. Every tuning number, colour and the whole
// room layout in one place. The playfield is a fixed 1280x720 logical area; the
// renderer scales it to the window, so no rule below depends on screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 15,
  speed: 178,
  sneakSpeed: 88,
  invulnerable: 2.5,
};

export const LIVES = 3;

/** Guards patrol waypoints, then converge or chase as the alarm climbs. */
export const GUARD = {
  radius: 15,
  patrolSpeed: 58,
  suspectSpeed: 72,
  chaseSpeed: 88,
  coneLength: 200,
  coneHalfAngle: 0.55,
  catchDistance: 27,
  /** Alarm per second while the thief stands in a guard's cone. */
  seeRate: 55,
};

/** Ceiling cameras sweep a fixed arc; EMP switches them off for a while. */
export const CAMERA = {
  coneLength: 232,
  coneHalfAngle: 0.5,
  sweepRange: 0.55,
  sweepSpeed: 0.55,
  seeRate: 42,
  empDuration: 6,
};

/** The alarm meter: 0-100. Stages change guard behaviour and the HUD colour. */
export const ALARM = {
  suspectAt: 35,
  alertAt: 70,
  decayPerSecond: 14,
  /** Detection is this much slower while the thief hides in a shadow patch. */
  shadowFactor: 0.4,
  /** Detection is this much slower while sneaking (Shift held). */
  sneakFactor: 0.5,
  /** Alarm the meter resets to after the thief is caught once. */
  afterCaught: 45,
};

/** Tools the thief carries. Each has a cost: a limited count, shown on the HUD. */
export const TOOLS = {
  empCount: 2,
  smokeCount: 2,
  smokeRadius: 95,
  smokeSeconds: 5,
};

/** Loot: four caches worth 100 each, and the Aurora Drive worth 500. */
export const LOOT = { cache: 100, core: 500 };
/** Time bonus on a win: one point per second under 300 seconds. */
export const WIN_BONUS_SECONDS = 300;

/** The room. Racks block movement and line of sight; the cold aisle is the
 *  vertical corridor down the middle (x 550-730) with the blue floor. */
export const RACKS = [
  { x: 170, y: 120, w: 380, h: 96 }, // top-left bank
  { x: 730, y: 120, w: 380, h: 96 }, // top-right bank
  { x: 170, y: 310, w: 180, h: 96 }, // mid-left bank
  { x: 930, y: 310, w: 180, h: 96 }, // mid-right bank
  { x: 170, y: 500, w: 380, h: 96 }, // bottom-left bank
  { x: 730, y: 500, w: 380, h: 96 }, // bottom-right bank
];

/** Dark patches where the thief is harder to spot. */
export const SHADOWS = [
  { x: 350, y: 216, w: 200, h: 94 },
  { x: 730, y: 406, w: 200, h: 94 },
  { x: 56, y: 310, w: 110, h: 96 },
];

/** Where the loot sits. The core drive is the target; the rest are optional.
 *  The core sits in the central aisle, just below the HUD row, so its gold
 *  star never hides behind the score text. */
export const LOOT_SPOTS = [
  { kind: 'core', x: 640, y: 108 },
  { kind: 'cache', x: 90, y: 70 },
  { kind: 'cache', x: 1190, y: 70 },
  { kind: 'cache', x: 90, y: 650 },
  { kind: 'cache', x: 1190, y: 650 },
];

/** The service door on the west wall: where the thief starts and must return. */
export const EXIT = { x: 20, y: 360, w: 10, h: 84 };
export const START = { x: 72, y: 360 };

/** Guard patrols: each guard walks its waypoints and back, forever. */
export const GUARD_PATROLS = [
  [{ x: 180, y: 70 }, { x: 1100, y: 70 }],
  [{ x: 400, y: 360 }, { x: 880, y: 360 }],
  [{ x: 1100, y: 650 }, { x: 180, y: 650 }],
];

/** Cameras: position, the angle they point at mid-sweep, and which way they face. */
export const CAMERAS = [
  { x: 640, y: 216, baseAngle: Math.PI / 2 },
  { x: 640, y: 500, baseAngle: -Math.PI / 2 },
];

export const PALETTE = {
  backdrop: '#0b0f16',
  floor: '#151b29',
  aisle: '#1b2740',
  aisleEdge: '#27395e',
  wall: '#2b3549',
  rack: '#222d42',
  rackEdge: '#35436a',
  rackLight: '#57e6c9',
  rackLightDim: '#2c6b60',
  shadow: '#0c1120',
  shadowEdge: '#1d2a44',
  thief: '#4fd8c8',
  thiefDark: '#1d7a6e',
  guard: '#e5534b',
  guardDark: '#7a2b26',
  cone: 'rgba(255, 205, 70, 0.2)',
  coneEdge: 'rgba(255, 205, 70, 0.5)',
  coneHot: 'rgba(255, 90, 60, 0.28)',
  coneHotEdge: 'rgba(255, 90, 60, 0.65)',
  camCone: 'rgba(255, 70, 60, 0.18)',
  camConeEdge: 'rgba(255, 70, 60, 0.45)',
  camOff: 'rgba(140, 150, 170, 0.14)',
  loot: '#f2c94c',
  lootGlow: 'rgba(242, 201, 76, 0.35)',
  exit: '#3ddc84',
  exitGlow: 'rgba(61, 220, 132, 0.3)',
  smoke: 'rgba(200, 210, 225, 0.4)',
  panel: '#1a2233',
  panelEdge: '#33415e',
  text: '#eef1f5',
  muted: '#93a0b8',
  gold: '#f2c94c',
  alarmCalm: '#3ddc84',
  alarmSuspect: '#f2c94c',
  alarmAlert: '#ff5148',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'cold-aisle.best';
