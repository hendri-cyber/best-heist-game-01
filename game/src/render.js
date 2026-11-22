// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Flat shapes and canvas text; the HUD names every
// mechanic so the frame reads at a glance even shrunk to 768x480.
import {
  ALARM, CAMERA, CAMERAS, EXIT, FIELD, FONT, GUARD, PALETTE, RACKS, SHADOWS, THIEF,
} from './config.js';
import { alarmStage, cameraAngle } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 128, line: 32, bottom: 72 };

function formatTime(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function wedge(x, y, angle, length, halfAngle, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, length, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 2;
    context.stroke();
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // The cold aisle: the blue vertical corridor down the middle.
    context.fillStyle = PALETTE.aisle;
    context.fillRect(550, 20, 180, 680);
    context.fillStyle = PALETTE.aisleEdge;
    context.fillRect(550, 20, 3, 680);
    context.fillRect(727, 20, 3, 680);
    context.save();
    context.fillStyle = 'rgba(90, 130, 200, 0.5)';
    context.font = `700 15px ${FONT}`;
    context.textAlign = 'center';
    context.translate(640, 380);
    context.rotate(-Math.PI / 2);
    context.fillText('C O L D   A I S L E', 0, 5);
    context.restore();
    // Shadow patches: dark floor where the thief is harder to spot.
    for (let i = 0; i < SHADOWS.length; i += 1) {
      const s = SHADOWS[i];
      context.fillStyle = PALETTE.shadow;
      context.fillRect(s.x, s.y, s.w, s.h);
      context.strokeStyle = PALETTE.shadowEdge;
      context.setLineDash([6, 5]);
      context.lineWidth = 2;
      context.strokeRect(s.x, s.y, s.w, s.h);
      context.setLineDash([]);
      text('SHADOW', s.x + s.w / 2, s.y + s.h / 2 + 5, 13, PALETTE.muted, 'center', false);
    }
    // Walls.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 20);
    context.fillRect(0, 700, FIELD.width, 20);
    context.fillRect(0, 0, 20, FIELD.height);
    context.fillRect(1260, 0, 20, FIELD.height);
    // Server racks with blinking lights (blink phase comes from the clock, so a
    // staged screenshot always draws the same lights).
    for (let r = 0; r < RACKS.length; r += 1) {
      const rack = RACKS[r];
      context.fillStyle = PALETTE.rack;
      context.fillRect(rack.x, rack.y, rack.w, rack.h);
      context.strokeStyle = PALETTE.rackEdge;
      context.lineWidth = 2;
      context.strokeRect(rack.x, rack.y, rack.w, rack.h);
      const cols = Math.floor(rack.w / 34);
      const rows = Math.floor(rack.h / 24);
      for (let c = 0; c < cols; c += 1) {
        for (let row = 0; row < rows; row += 1) {
          const lit = Math.floor(state.time * 2 + r * 1.7 + c * 0.6 + row * 1.3) % 3 !== 0;
          context.fillStyle = lit ? PALETTE.rackLight : PALETTE.rackLightDim;
          context.fillRect(rack.x + 10 + c * 34, rack.y + 9 + row * 24, 14, 5);
        }
      }
    }
    // The exit door on the west wall.
    context.fillStyle = PALETTE.exit;
    context.fillRect(EXIT.x, EXIT.y - EXIT.h / 2, EXIT.w, EXIT.h);
    context.fillStyle = PALETTE.exitGlow;
    context.fillRect(EXIT.x + EXIT.w, EXIT.y - EXIT.h / 2, 26, EXIT.h);
    text('EXIT', 66, EXIT.y - EXIT.h / 2 - 10, 18, PALETTE.exit, 'center', true);
  }

  function drawSmoke(state) {
    for (let i = 0; i < state.smoke.length; i += 1) {
      const c = state.smoke[i];
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(220, 230, 245, 0.25)';
      context.beginPath();
      context.arc(c.x, c.y, c.r * 0.62, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawLoot(state) {
    for (let i = 0; i < state.loot.length; i += 1) {
      const item = state.loot[i];
      if (item.taken) continue;
      const pulse = 1 + 0.12 * Math.sin(state.time * 3 + i * 2);
      if (item.kind === 'core') {
        context.fillStyle = PALETTE.lootGlow;
        context.beginPath();
        context.arc(item.x, item.y, 30 * pulse, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.loot;
        context.beginPath();
        for (let k = 0; k < 8; k += 1) {
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
          const rad = k % 2 === 0 ? 17 : 8;
          const px = item.x + Math.cos(a) * rad;
          const py = item.y + Math.sin(a) * rad;
          if (k === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fill();
        text('AURORA DRIVE', item.x, item.y - 30, 15, PALETTE.loot, 'center', true);
      } else {
        context.fillStyle = PALETTE.lootGlow;
        context.beginPath();
        context.arc(item.x, item.y, 18 * pulse, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = PALETTE.loot;
        context.save();
        context.translate(item.x, item.y);
        context.rotate(Math.PI / 4);
        context.fillRect(-8, -8, 16, 16);
        context.restore();
      }
    }
  }

  function drawGuards(state) {
    const stage = alarmStage(state.alarm);
    for (let i = 0; i < state.guards.length; i += 1) {
      const g = state.guards[i];
      const hot = stage !== 'calm';
      wedge(g.x, g.y, g.angle, GUARD.coneLength, GUARD.coneHalfAngle,
        hot ? PALETTE.coneHot : PALETTE.cone, hot ? PALETTE.coneHotEdge : PALETTE.coneEdge);
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = PALETTE.guardDark;
      context.lineWidth = 3;
      context.stroke();
      // The guard's facing tick, so the patrol direction reads at a glance.
      context.strokeStyle = '#ffd9d4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(g.x, g.y);
      context.lineTo(g.x + Math.cos(g.angle) * (GUARD.radius + 7), g.y + Math.sin(g.angle) * (GUARD.radius + 7));
      context.stroke();
    }
  }

  function drawCameras(state) {
    for (let i = 0; i < state.cameras.length; i += 1) {
      const c = state.cameras[i];
      const off = state.empTimer > 0;
      const angle = cameraAngle(c, state.time);
      if (off) {
        wedge(c.x, c.y, angle, CAMERA.coneLength, CAMERA.coneHalfAngle, PALETTE.camOff, PALETTE.camOff);
      } else {
        wedge(c.x, c.y, angle, CAMERA.coneLength, CAMERA.coneHalfAngle, PALETTE.camCone, PALETTE.camConeEdge);
      }
      context.fillStyle = off ? '#8b93a3' : '#ff5148';
      context.fillRect(c.x - 9, c.y - 7, 18, 14);
      context.fillStyle = '#1a2233';
      context.beginPath();
      context.arc(c.x + Math.cos(angle) * 8, c.y + Math.sin(angle) * 8, 3.5, 0, Math.PI * 2);
      context.fill();
      if (off) text('OFF', c.x, c.y - 14, 13, '#c8d2e0', 'center', true);
    }
  }

  function drawThief(state) {
    const t = state.thief;
    if (t.invulnerable > 0 && Math.floor(t.invulnerable * 10) % 2 === 0) return;
    // A pale ring so the thief pops against dark floor and shadow patches.
    context.strokeStyle = 'rgba(238, 241, 245, 0.85)';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(t.x, t.y, THIEF.radius + 3, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(t.x, t.y, THIEF.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefDark;
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = '#0b0f16';
    context.beginPath();
    context.arc(t.x + Math.cos(t.angle) * 6, t.y + Math.sin(t.angle) * 6, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    // Row 1: title left, the alarm meter dead centre, time right.
    text('COLD AISLE', 30, 26, 22, PALETTE.text, 'left', true);
    text(`TIME ${formatTime(state.elapsed)}`, FIELD.width - 30, 26, 22, PALETTE.text, 'right', true);
    // Row 2: loot left, score centre, lives right — nothing shares a line
    // with the alarm bar, so no label ever hides behind it.
    text(`LOOT ${state.lootTaken}/5`, 30, 52, 17, state.coreTaken ? PALETTE.gold : PALETTE.muted, 'left', true);
    text(`SCORE ${state.score}`, FIELD.width / 2, 52, 20, PALETTE.text, 'center', true);
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < state.lives ? PALETTE.thief : '#2a3040';
      context.beginPath();
      context.arc(FIELD.width - 38 - i * 22, 62, 7, 0, Math.PI * 2);
      context.fill();
    }
    // The alarm meter: the frame's most important bar.
    const stage = alarmStage(state.alarm);
    const barX = 470;
    const barY = 28;
    const barW = 300;
    const barH = 18;
    const colour = stage === 'alert' ? PALETTE.alarmAlert : stage === 'suspect' ? PALETTE.alarmSuspect : PALETTE.alarmCalm;
    text('ALARM', barX - 12, barY + 1, 17, colour, 'right', true);
    context.fillStyle = '#232c3d';
    context.fillRect(barX, barY, barW, barH);
    context.fillStyle = colour;
    context.fillRect(barX, barY, Math.round(barW * state.alarm / 100), barH);
    context.strokeStyle = '#3a4a68';
    context.lineWidth = 2;
    context.strokeRect(barX, barY, barW, barH);
    text(stage.toUpperCase(), barX + barW + 12, barY + 1, 17, colour, 'left', true);
    // Tools, bottom-left: names, counts and keys.
    text(`EMP ×${state.empLeft}  [E]`, 30, FIELD.height - 34, 18, state.empLeft > 0 ? PALETTE.text : PALETTE.muted, 'left', true);
    text(`SMOKE ×${state.smokeLeft}  [Q]`, 170, FIELD.height - 34, 18, state.smokeLeft > 0 ? PALETTE.text : PALETTE.muted, 'left', true);
    text('Shift = sneak', FIELD.width - 30, FIELD.height - 34, 18, PALETTE.muted, 'right', false);
    context.textBaseline = 'alphabetic';
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 74, 44, PALETTE.gold, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 20, PALETTE.muted, 'center', false);
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center', true);
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen. */
  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawSmoke(state);
    drawGuards(state);
    drawCameras(state);
    // Loot draws over the cones, so the gold target stays readable even
    // when a cone sweeps across it.
    drawLoot(state);
    drawThief(state);
    if (screen === SCREEN_TITLE) {
      drawPanel('COLD AISLE', [
        'Steal the Aurora Drive from the cold aisle.',
        'Dodge guard cones and sweeping cameras.',
        'Grab the loot, then slip out the green door.',
        'Move WASD / arrows · Shift sneak · E EMP · Q smoke',
        'Click the floor to walk there · P pause',
        `Best ${best}`,
      ], 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Caught!', [`Score ${state.score}`, `Best ${best}`], 'Press Space to try again');
    } else if (screen === SCREEN_WIN) {
      const lootPoints = (state.lootTaken - (state.coreTaken ? 1 : 0)) * 100 + (state.coreTaken ? 500 : 0);
      const bonus = state.score - lootPoints;
      drawPanel('Clean getaway!', [
        `Loot ${lootPoints} · Time bonus ${bonus}`,
        `Score ${state.score} · Best ${Math.max(best, state.score)}`,
      ], 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
