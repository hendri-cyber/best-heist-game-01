// The screenshot scenes behind ?shot=cover|tense|alarm|escape. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really looks
// like and the same seed always gives the same frame.
import { EXIT, STEP } from './config.js';
import { dangerAt, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const COVER_SECONDS = 16;
const TENSE_SECONDS = 26;
const ALARM_LIMIT_SECONDS = 60;
const ESCAPE_LIMIT_SECONDS = 150;
const SAMPLE = 1 / 30;

/** Eight compass directions plus standing still. */
const DIRECTIONS = [
  [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** The autopilot's current target: the nearest loot, then the exit door.
 *  With `skipCore`, the Aurora Drive is left for last, so a staged frame can
 *  still show the gold target sitting in the room. */
function targetOf(state, skipCore) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < state.loot.length; i += 1) {
    const item = state.loot[i];
    if (item.taken) continue;
    if (skipCore && item.kind === 'core') continue;
    const dx = item.x - state.thief.x;
    const dy = item.y - state.thief.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = { x: item.x, y: item.y };
    }
  }
  if (best !== null) return best;
  for (let i = 0; i < state.loot.length; i += 1) {
    const item = state.loot[i];
    if (!item.taken) return { x: item.x, y: item.y };
  }
  return { x: EXIT.x + 44, y: EXIT.y };
}

/**
 * Greedy steering: of the nine ways to move, the one that gets closest to the
 * target without stepping into a watcher's cone. `caution` weighs the danger:
 * a cautious pilot avoids cones, a reckless one walks straight at the loot.
 * A pilot already standing in a cone sneaks, which halves how fast the alarm
 * climbs while it slips out.
 */
function autopilot(state, caution, skipCore) {
  const target = targetOf(state, skipCore);
  const thief = state.thief;
  // The final leg is the run that matters: all loot in hand, one walk to the
  // door. Sneak the whole way and give cones a wide berth, even if it costs
  // seconds — a caught thief respawns at the door and the getaway is gone.
  const finalLeg = state.lootTaken === 5;
  const weight = finalLeg ? 5000 : caution;
  let bestDir = DIRECTIONS[0];
  let bestScore = -Infinity;
  for (let i = 0; i < DIRECTIONS.length; i += 1) {
    const dir = DIRECTIONS[i];
    const nx = thief.x + dir[0] * 21;
    const ny = thief.y + dir[1] * 21;
    const dx = target.x - nx;
    const dy = target.y - ny;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const danger = dangerAt(state, nx, ny, false);
    const score = -dist - danger * weight;
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return {
    dx: bestDir[0], dy: bestDir[1],
    sneak: finalLeg || dangerAt(state, thief.x, thief.y, false) > 0,
    // Tools are spent, not hoarded: EMP when the alarm is climbing and the
    // cameras are live, smoke when the thief is already seen and the alarm
    // is high. Each fires once — the world blocks repeats while it lasts.
    emp: state.empLeft > 0 && state.empTimer <= 0 && state.alarm > 45,
    smoke: state.smokeLeft > 0 && state.smoke.length === 0
      && dangerAt(state, thief.x, thief.y, false) > 0 && state.alarm > 55,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'tense' && name !== 'alarm' && name !== 'escape' && name !== 'cover') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { dx: 0, dy: 0, sneak: false, emp: false, smoke: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'cover') {
    // The cover leaves the Aurora Drive for last, so the gold target is still
    // sitting in the room when the frame is taken.
    for (let i = 0; i < COVER_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 900, true), false);
      if (world.state.won || world.state.over) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'tense') {
    // Stop the moment the alarm first turns suspicious: the frame shows the
    // thief close to a cone with the meter climbing, not a calm stroll.
    for (let i = 0; i < TENSE_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 900, false), false);
      if (world.state.alarm >= 35 || world.state.won || world.state.over) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alarm') {
    for (let i = 0; i < ALARM_LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 0, false), false);
      if (world.state.alarm >= 70 || world.state.won || world.state.over) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  for (let i = 0; i < ESCAPE_LIMIT_SECONDS / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state, 1500, false), false);
    if (events & EVENT_WIN || world.state.over) break;
    // Stop at the door only with the full haul: a respawned thief standing at
    // the door with loot missing is not a getaway.
    const t = world.state.thief;
    if (world.state.lootTaken === 5 && t.x >= 74 && t.x < 230 && Math.abs(t.y - 360) < 80) break;
  }
  if (world.state.won) return { screen: SCREEN_WIN, best: world.state.score };
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
