// COLD AISLE — the game's rules and state, with no drawing and no browser in
// it: the thief, the patrolling guards and their vision cones, the sweeping
// cameras, the loot, the alarm meter and the two tools. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns.
import {
  ALARM, CAMERA, CAMERAS, EXIT, FIELD, GUARD, GUARD_PATROLS, LIVES, LOOT,
  LOOT_SPOTS, RACKS, SHADOWS, START, THIEF, TOOLS, WIN_BONUS_SECONDS,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_WIN = 4;
export const EVENT_OVER = 8;
export const EVENT_TOOL = 16;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

/** Push a circle out of a rectangle (thief and guards cannot walk through racks). */
function resolveCircle(pos, radius, rect) {
  const cx = clamp(pos.x, rect.x, rect.x + rect.w);
  const cy = clamp(pos.y, rect.y, rect.y + rect.h);
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    pos.x = cx + (dx / d) * radius;
    pos.y = cy + (dy / d) * radius;
    return;
  }
  const left = pos.x - rect.x;
  const right = rect.x + rect.w - pos.x;
  const top = pos.y - rect.y;
  const bottom = rect.y + rect.h - pos.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) pos.x = rect.x - radius;
  else if (m === right) pos.x = rect.x + rect.w + radius;
  else if (m === top) pos.y = rect.y - radius;
  else pos.y = rect.y + rect.h + radius;
}

/** True when the segment from (x1,y1) to (x2,y2) crosses a rectangle. */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  let tmin = 0;
  let tmax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < rect.x || x1 > rect.x + rect.w) return false;
  } else {
    let t1 = (rect.x - x1) / dx;
    let t2 = (rect.x + rect.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y1 < rect.y || y1 > rect.y + rect.h) return false;
  } else {
    let t1 = (rect.y - y1) / dy;
    let t2 = (rect.y + rect.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function inShadow(x, y) {
  for (let i = 0; i < SHADOWS.length; i += 1) {
    const s = SHADOWS[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

function inSmoke(state, x, y) {
  for (let i = 0; i < state.smoke.length; i += 1) {
    const c = state.smoke[i];
    const dx = x - c.x;
    const dy = y - c.y;
    if (dx * dx + dy * dy < c.r * c.r) return true;
  }
  return false;
}

/** Line of sight: no rack between the observer and the point. */
function losClear(x1, y1, x2, y2) {
  for (let i = 0; i < RACKS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, RACKS[i])) return false;
  }
  return true;
}

/** Is the point inside a vision cone of this length and half-angle? */
function inCone(ox, oy, angle, length, halfAngle, x, y) {
  const dx = x - ox;
  const dy = y - oy;
  const d2 = dx * dx + dy * dy;
  if (d2 > length * length) return false;
  if (d2 < 1) return true;
  const d = Math.sqrt(d2);
  const dot = (dx * Math.cos(angle) + dy * Math.sin(angle)) / d;
  return dot > Math.cos(halfAngle);
}

/** A camera's current sweep angle from the world's clock. */
export function cameraAngle(camera, time) {
  return camera.baseAngle + Math.sin(time * CAMERA.sweepSpeed) * CAMERA.sweepRange;
}

/**
 * How fast the alarm rises (per second) for someone standing at (x, y):
 * the strongest watcher that can see the spot, or 0 when nobody can.
 * Smoke hides the spot completely; shadows and sneaking slow the rise.
 */
export function dangerAt(state, x, y, sneak) {
  if (inSmoke(state, x, y)) return 0;
  let best = 0;
  for (let i = 0; i < state.guards.length; i += 1) {
    const g = state.guards[i];
    if (inCone(g.x, g.y, g.angle, GUARD.coneLength, GUARD.coneHalfAngle, x, y)
      && losClear(g.x, g.y, x, y)) {
      let rate = GUARD.seeRate;
      if (inShadow(x, y)) rate *= ALARM.shadowFactor;
      if (sneak) rate *= ALARM.sneakFactor;
      if (rate > best) best = rate;
    }
  }
  if (state.empTimer <= 0) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const c = state.cameras[i];
      const angle = cameraAngle(c, state.time);
      if (inCone(c.x, c.y, angle, CAMERA.coneLength, CAMERA.coneHalfAngle, x, y)
        && losClear(c.x, c.y, x, y)) {
        let rate = CAMERA.seeRate;
        if (inShadow(x, y)) rate *= ALARM.shadowFactor;
        if (sneak) rate *= ALARM.sneakFactor;
        if (rate > best) best = rate;
      }
    }
  }
  return best;
}

export function alarmStage(alarm) {
  if (alarm >= ALARM.alertAt) return 'alert';
  if (alarm >= ALARM.suspectAt) return 'suspect';
  return 'calm';
}

export function createWorld(random) {
  const thief = { x: START.x, y: START.y, angle: 0, invulnerable: 0 };
  const guards = [];
  for (let i = 0; i < GUARD_PATROLS.length; i += 1) {
    const patrol = GUARD_PATROLS[i];
    guards.push({
      x: patrol[0].x, y: patrol[0].y,
      angle: Math.atan2(patrol[1].y - patrol[0].y, patrol[1].x - patrol[0].x),
      wpIndex: 1, mode: 'patrol', sweep: 0, sweepBase: null,
    });
  }
  const cameras = [];
  for (let i = 0; i < CAMERAS.length; i += 1) {
    cameras.push({ x: CAMERAS[i].x, y: CAMERAS[i].y, baseAngle: CAMERAS[i].baseAngle });
  }
  const loot = [];
  for (let i = 0; i < LOOT_SPOTS.length; i += 1) {
    loot.push({ kind: LOOT_SPOTS[i].kind, x: LOOT_SPOTS[i].x, y: LOOT_SPOTS[i].y, taken: false });
  }
  const state = {
    thief, guards, cameras, loot,
    smoke: [], alarm: 0, lastSeen: null,
    score: 0, lives: LIVES, lootTaken: 0, coreTaken: false,
    elapsed: 0, time: 0, empTimer: 0, empLeft: TOOLS.empCount, smokeLeft: TOOLS.smokeCount,
    won: false, over: false,
  };

  function reset() {
    thief.x = START.x;
    thief.y = START.y;
    thief.angle = 0;
    thief.invulnerable = 0;
    for (let i = 0; i < guards.length; i += 1) {
      const patrol = GUARD_PATROLS[i];
      guards[i].x = patrol[0].x;
      guards[i].y = patrol[0].y;
      guards[i].angle = Math.atan2(patrol[1].y - patrol[0].y, patrol[1].x - patrol[0].x);
      guards[i].wpIndex = 1;
      guards[i].mode = 'patrol';
      guards[i].sweep = 0;
      guards[i].sweepBase = null;
    }
    for (let i = 0; i < loot.length; i += 1) loot[i].taken = false;
    state.smoke.length = 0;
    state.alarm = 0;
    state.lastSeen = null;
    state.score = 0;
    state.lives = LIVES;
    state.lootTaken = 0;
    state.coreTaken = false;
    state.elapsed = 0;
    state.time = 0;
    state.empTimer = 0;
    state.empLeft = TOOLS.empCount;
    state.smokeLeft = TOOLS.smokeCount;
    state.won = false;
    state.over = false;
  }

  function collide(pos, radius) {
    for (let i = 0; i < RACKS.length; i += 1) resolveCircle(pos, radius, RACKS[i]);
    pos.x = clamp(pos.x, 20 + radius, FIELD.width - 20 - radius);
    pos.y = clamp(pos.y, 20 + radius, FIELD.height - 20 - radius);
  }

  function updateGuard(g, patrol, dt, stage) {
    let tx;
    let ty;
    let speed;
    if (stage === 'alert') {
      tx = thief.x;
      ty = thief.y;
      speed = GUARD.chaseSpeed;
      g.mode = 'chase';
    } else if (stage === 'suspect' && state.lastSeen !== null) {
      tx = state.lastSeen.x;
      ty = state.lastSeen.y;
      speed = GUARD.suspectSpeed;
      g.mode = 'suspect';
      const dx = tx - g.x;
      const dy = ty - g.y;
      if (dx * dx + dy * dy < 144) {
        // At the last-seen spot: scan back and forth instead of spinning,
        // so a still frame reads as a guard looking around, not lost.
        if (g.sweepBase === null) {
          g.sweepBase = g.angle;
          g.sweep = 0;
        }
        g.sweep += dt;
        g.angle = g.sweepBase + Math.sin(g.sweep * 1.4) * 1.1;
        return;
      }
      g.sweepBase = null;
    } else {
      const wp = patrol[g.wpIndex];
      tx = wp.x;
      ty = wp.y;
      speed = GUARD.patrolSpeed;
      g.mode = 'patrol';
      const dx = tx - g.x;
      const dy = ty - g.y;
      if (dx * dx + dy * dy < 100) {
        g.wpIndex = (g.wpIndex + 1) % patrol.length;
        return;
      }
    }
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.5) return;
    g.x += (dx / d) * speed * dt;
    g.y += (dy / d) * speed * dt;
    g.angle = Math.atan2(dy, dx);
    collide(g, GUARD.radius);
  }

  /**
   * One fixed step. `move` is {dx, dy, sneak, emp, smoke, click} — dx/dy are a
   * direction (any length; normalised here). With `harmless` set (the title
   * screen's backdrop) the room lives but nothing scores and nobody is seen.
   */
  function step(dt, move, harmless) {
    let events = 0;
    state.time += dt;
    if (harmless) {
      for (let i = 0; i < guards.length; i += 1) updateGuard(guards[i], GUARD_PATROLS[i], dt, 'calm');
      return events;
    }
    state.elapsed += dt;
    if (thief.invulnerable > 0) thief.invulnerable = Math.max(0, thief.invulnerable - dt);
    if (state.empTimer > 0) state.empTimer = Math.max(0, state.empTimer - dt);

    if (move.emp && state.empLeft > 0 && state.empTimer <= 0) {
      state.empLeft -= 1;
      state.empTimer = CAMERA.empDuration;
      events |= EVENT_TOOL;
    }
    if (move.smoke && state.smokeLeft > 0) {
      state.smokeLeft -= 1;
      state.smoke.push({ x: thief.x, y: thief.y, r: TOOLS.smokeRadius, t: TOOLS.smokeSeconds });
      events |= EVENT_TOOL;
    }
    for (let i = state.smoke.length - 1; i >= 0; i -= 1) {
      state.smoke[i].t -= dt;
      if (state.smoke[i].t <= 0) state.smoke.splice(i, 1);
    }

    const len = Math.hypot(move.dx, move.dy);
    if (len > 0.001) {
      const speed = move.sneak ? THIEF.sneakSpeed : THIEF.speed;
      thief.x += (move.dx / len) * speed * dt;
      thief.y += (move.dy / len) * speed * dt;
      thief.angle = Math.atan2(move.dy, move.dx);
      collide(thief, THIEF.radius);
    }

    const stage = alarmStage(state.alarm);
    for (let i = 0; i < guards.length; i += 1) updateGuard(guards[i], GUARD_PATROLS[i], dt, stage);

    let rate = 0;
    if (thief.invulnerable === 0) rate = dangerAt(state, thief.x, thief.y, move.sneak);
    if (rate > 0) {
      state.alarm = Math.min(100, state.alarm + rate * dt);
      state.lastSeen = { x: thief.x, y: thief.y };
    } else {
      state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
    }

    for (let i = 0; i < loot.length; i += 1) {
      const item = loot[i];
      if (item.taken) continue;
      const dx = thief.x - item.x;
      const dy = thief.y - item.y;
      if (dx * dx + dy * dy < 26 * 26) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += item.kind === 'core' ? LOOT.core : LOOT.cache;
        if (item.kind === 'core') state.coreTaken = true;
        events |= EVENT_LOOT;
      }
    }

    if (state.coreTaken && thief.x < EXIT.x + EXIT.w + 44 && Math.abs(thief.y - EXIT.y) < 46) {
      state.won = true;
      state.score += Math.max(0, WIN_BONUS_SECONDS - Math.floor(state.elapsed));
      return events | EVENT_WIN;
    }

    let caught = state.alarm >= 100;
    if (!caught && alarmStage(state.alarm) === 'alert') {
      for (let i = 0; i < guards.length; i += 1) {
        const g = guards[i];
        const dx = thief.x - g.x;
        const dy = thief.y - g.y;
        if (dx * dx + dy * dy < GUARD.catchDistance * GUARD.catchDistance) {
          caught = true;
          break;
        }
      }
    }
    if (caught) {
      state.lives -= 1;
      if (state.lives <= 0) {
        state.over = true;
        return events | EVENT_OVER;
      }
      thief.x = START.x;
      thief.y = START.y;
      thief.invulnerable = THIEF.invulnerable;
      state.alarm = ALARM.afterCaught;
      state.lastSeen = null;
      for (let i = 0; i < guards.length; i += 1) {
        const patrol = GUARD_PATROLS[i];
        guards[i].x = patrol[0].x;
        guards[i].y = patrol[0].y;
        guards[i].angle = Math.atan2(patrol[1].y - patrol[0].y, patrol[1].x - patrol[0].x);
        guards[i].wpIndex = 1;
        guards[i].mode = 'patrol';
        guards[i].sweep = 0;
        guards[i].sweepBase = null;
      }
      events |= EVENT_CAUGHT;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
