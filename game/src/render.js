// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Flat shapes and canvas text: floor tiles,
// gold-trimmed walls, glass cases, amber guard cones, red camera cones,
// blinking lasers, the thief, the HUD and the panels.
import { BOUNDS, FIELD, FONT, PALETTE, THIEF } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_PERFECT = 'perfect';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const HUD_HEIGHT = 88;

function money(value) {
  return '$' + value.toLocaleString('en-US');
}

function clock(seconds) {
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
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

  function text(value, x, y, size, color, align = 'left', baseline = 'alphabetic') {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
  }

  /** World point → canvas pixel (for the input's click mapping). */
  function toCanvas(wx, wy) {
    return { x: view.x + wx * view.scale, y: view.y + wy * view.scale };
  }

  /** Client point → world point, or null when the click misses the field. */
  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    const wx = (px - view.x) / view.scale;
    const wy = (py - view.y) / view.scale;
    if (wx < 0 || wx > FIELD.width || wy < 0 || wy > FIELD.height) return null;
    return { x: wx, y: wy };
  }

  function cone(cx, cy, angle, halfAngle, range, fill, edge) {
    context.beginPath();
    context.moveTo(cx, cy);
    context.arc(cx, cy, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Parquet tiles.
    context.strokeStyle = PALETTE.floorTile;
    context.lineWidth = 1;
    for (let x = 0; x < FIELD.width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y < FIELD.height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    // The carpet runner down the middle of the room.
    context.fillStyle = PALETTE.carpet;
    context.fillRect(BOUNDS.x + 560, BOUNDS.y, 128, BOUNDS.height);
    context.strokeStyle = PALETTE.carpetEdge;
    context.lineWidth = 3;
    context.strokeRect(BOUNDS.x + 560, BOUNDS.y, 128, BOUNDS.height);
    // Outer wall with gold trim.
    context.fillStyle = PALETTE.wall;
    context.fillRect(BOUNDS.x - 8, BOUNDS.y - 8, BOUNDS.width + 16, 12);
    context.fillRect(BOUNDS.x - 8, BOUNDS.y + BOUNDS.height - 4, BOUNDS.width + 16, 12);
    context.fillRect(BOUNDS.x - 8, BOUNDS.y - 8, 12, BOUNDS.height + 16);
    context.fillRect(BOUNDS.x + BOUNDS.width - 4, BOUNDS.y - 8, 12, BOUNDS.height + 16);
    context.strokeStyle = PALETTE.wallTrim;
    context.lineWidth = 2;
    context.strokeRect(BOUNDS.x - 8, BOUNDS.y - 8, BOUNDS.width + 16, BOUNDS.height + 16);
  }

  function drawRoom(state) {
    const room = state.room;
    // Interior walls.
    for (const wall of room.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.strokeStyle = PALETTE.wallTrim;
      context.lineWidth = 2;
      context.strokeRect(wall.x, wall.y, wall.w, wall.h);
    }
    // Display cases.
    for (const c of room.cases) {
      context.fillStyle = PALETTE.caseGlass;
      context.fillRect(c.x, c.y, c.w, c.h);
      context.strokeStyle = PALETTE.caseFrame;
      context.lineWidth = 2;
      context.strokeRect(c.x, c.y, c.w, c.h);
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(c.x + c.w / 2, c.y + c.h / 2, 6, 0, Math.PI * 2);
      context.fill();
    }
    // The loot case, with a pulsing gold glow until it is cracked.
    const loot = room.loot;
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 3);
    if (!state.thief.carrying) {
      context.fillStyle = `rgba(255, 217, 77, ${0.10 + 0.12 * pulse})`;
      context.fillRect(loot.x - 14, loot.y - 14, loot.w + 28, loot.h + 28);
    }
    context.fillStyle = PALETTE.caseGlass;
    context.fillRect(loot.x, loot.y, loot.w, loot.h);
    context.strokeStyle = PALETTE.lootGlow;
    context.lineWidth = 3;
    context.strokeRect(loot.x, loot.y, loot.w, loot.h);
    if (!state.thief.carrying) drawLootIcon(loot, loot.x + loot.w / 2, loot.y + loot.h / 2);
    text(loot.label, loot.x + loot.w / 2, loot.y - 8, 15, PALETTE.gold, 'center');
    // Side loot: small gold pouches.
    for (const item of room.sideLoot) {
      if (item.taken) continue;
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.arc(item.x, item.y, 8, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#7a5c00';
      text('$', item.x, item.y + 4, 11, '#7a5c00', 'center');
    }
    // Lasers: red when live, faint dotted when dark.
    for (const laser of state.lasers) {
      context.lineWidth = 3;
      if (laser.on) {
        context.strokeStyle = PALETTE.laser;
        context.setLineDash([]);
        context.beginPath();
        context.moveTo(laser.x1, laser.y1);
        context.lineTo(laser.x2, laser.y2);
        context.stroke();
        context.fillStyle = PALETTE.laser;
        context.beginPath();
        context.arc(laser.x1, laser.y1, 5, 0, Math.PI * 2);
        context.fill();
        context.beginPath();
        context.arc(laser.x2, laser.y2, 5, 0, Math.PI * 2);
        context.fill();
      } else {
        context.strokeStyle = PALETTE.laserOff;
        context.setLineDash([4, 8]);
        context.beginPath();
        context.moveTo(laser.x1, laser.y1);
        context.lineTo(laser.x2, laser.y2);
        context.stroke();
        context.setLineDash([]);
      }
    }
    // Camera junction boxes (hack targets).
    room.junctions.forEach((junction, index) => {
      const hacked = state.cameras[junction.camera].hacked;
      context.fillStyle = hacked ? '#555c66' : '#d8dee6';
      context.fillRect(junction.x - 9, junction.y - 9, 18, 18);
      context.strokeStyle = hacked ? '#888' : PALETTE.gold;
      context.lineWidth = 2;
      context.strokeRect(junction.x - 9, junction.y - 9, 18, 18);
      if (hacked) {
        text('✕', junction.x, junction.y + 5, 15, '#ff6b60', 'center');
      } else {
        text('⚡', junction.x, junction.y + 5, 13, '#333', 'center');
      }
      if (state.hackTarget === index && state.hackProgress > 0) {
        drawProgressRing(junction.x, junction.y, 22, state.hackProgress, PALETTE.gold);
      }
    });
    // The GETAWAY door.
    const exit = room.exit;
    const exitGlow = state.thief.carrying ? 0.25 + 0.2 * pulse : 0.12;
    context.fillStyle = `rgba(47, 174, 95, ${exitGlow})`;
    context.fillRect(exit.x - 8, exit.y - 8, exit.w + 16, exit.h + 16);
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    text('GETAWAY', exit.x + exit.w / 2, exit.y + exit.h / 2 + 5, 13, '#062b14', 'center');
  }

  function drawLootIcon(loot, cx, cy) {
    if (loot.kind === 'diamond') {
      context.fillStyle = '#bfe9ff';
      context.beginPath();
      context.moveTo(cx, cy - 14);
      context.lineTo(cx + 12, cy);
      context.lineTo(cx, cy + 14);
      context.lineTo(cx - 12, cy);
      context.closePath();
      context.fill();
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.5;
      context.stroke();
    } else if (loot.kind === 'core') {
      context.fillStyle = '#ff9d5c';
      context.beginPath();
      context.arc(cx, cy, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffd9a8';
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = '#fff3df';
      context.beginPath();
      context.arc(cx - 4, cy - 4, 4, 0, Math.PI * 2);
      context.fill();
    } else {
      // crown
      context.fillStyle = PALETTE.gold;
      context.beginPath();
      context.moveTo(cx - 14, cy + 10);
      context.lineTo(cx - 14, cy - 6);
      context.lineTo(cx - 7, cy + 2);
      context.lineTo(cx, cy - 10);
      context.lineTo(cx + 7, cy + 2);
      context.lineTo(cx + 14, cy - 6);
      context.lineTo(cx + 14, cy + 10);
      context.closePath();
      context.fill();
    }
  }

  function drawProgressRing(x, y, radius, progress, color) {
    context.beginPath();
    context.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.stroke();
  }

  function drawConesAndActors(state) {
    // Camera cones first (under the guards).
    for (const camera of state.cameras) {
      if (camera.hacked) continue;
      cone(camera.x, camera.y, camera.angle, 0.49, 275, PALETTE.coneCamera, PALETTE.coneCameraEdge);
    }
    // Guard cones.
    for (const guard of state.guards) {
      const chasing = guard.mode === 'chase';
      cone(guard.x, guard.y, guard.facing, 0.56, 235,
        chasing ? 'rgba(229, 83, 75, 0.28)' : PALETTE.coneGuard,
        chasing ? 'rgba(229, 83, 75, 0.7)' : PALETTE.coneGuardEdge);
    }
    // Cameras themselves.
    for (const camera of state.cameras) {
      context.fillStyle = camera.hacked ? '#555c66' : '#2b2f38';
      context.beginPath();
      context.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = camera.hacked ? '#888' : PALETTE.laser;
      context.lineWidth = 2;
      context.stroke();
      if (camera.hacked) text('✕', camera.x, camera.y + 4, 11, '#ff6b60', 'center');
      else {
        context.fillStyle = PALETTE.laser;
        context.beginPath();
        context.arc(camera.x, camera.y, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
    // The thrown coin.
    if (state.thrownCoin) {
      const blink = 0.6 + 0.4 * Math.sin(state.elapsed * 8);
      context.fillStyle = `rgba(255, 217, 77, ${blink})`;
      context.beginPath();
      context.arc(state.thrownCoin.x, state.thrownCoin.y, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#7a5c00';
      context.lineWidth = 1.5;
      context.stroke();
    }
    // Guards.
    for (const guard of state.guards) {
      const chasing = guard.mode === 'chase';
      context.fillStyle = chasing ? PALETTE.guardChase : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = chasing ? '#ff8a80' : '#9db8d6';
      context.lineWidth = 2;
      context.stroke();
      // Facing tick.
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
      context.strokeStyle = '#e8eef5';
      context.lineWidth = 2;
      context.stroke();
      // Suspicion: ? while wary, ! while chasing.
      if (chasing) text('!', guard.x, guard.y - 22, 22, '#ff6b60', 'center');
      else if (guard.suspicion > 0.25) text('?', guard.x, guard.y - 22, 20, PALETTE.gold, 'center');
      if (guard.suspicion > 0.02 && guard.suspicion < 1) {
        context.fillStyle = '#3a2024';
        context.fillRect(guard.x - 14, guard.y - 34, 28, 5);
        context.fillStyle = PALETTE.gold;
        context.fillRect(guard.x - 14, guard.y - 34, 28 * guard.suspicion, 5);
      }
    }
    // The thief: a dark-suited figure with a gold-trimmed hat brim.
    const thief = state.thief;
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.arc(thief.x, thief.y, THIEF.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thiefTrim;
    context.lineWidth = 2.5;
    context.stroke();
    // Hat brim.
    context.beginPath();
    context.ellipse(thief.x, thief.y - 3, 10, 5, 0, 0, Math.PI * 2);
    context.fillStyle = '#23233a';
    context.fill();
    context.strokeStyle = PALETTE.thiefTrim;
    context.lineWidth = 1.5;
    context.stroke();
    // The carried loot glints above the thief's head.
    if (thief.carrying) {
      drawLootIcon(state.room.loot, thief.x, thief.y - 26);
    }
    // Crack progress ring over the loot case.
    if (state.crackProgress > 0) {
      drawProgressRing(
        state.room.loot.x + state.room.loot.w / 2,
        state.room.loot.y + state.room.loot.h / 2,
        34, state.crackProgress, PALETTE.gold,
      );
      text('CRACKING…', state.room.loot.x + state.room.loot.w / 2, state.room.loot.y + state.room.loot.h / 2 + 52, 14, PALETTE.gold, 'center');
    }
  }

  function drawHud(state, screen, take) {
    context.fillStyle = 'rgba(10, 11, 16, 0.88)';
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, HUD_HEIGHT - 2, FIELD.width, 2);
    const room = state.room;
    text(room.name, 24, 30, 24, PALETTE.text);
    text(room.floor, 24, 56, 15, PALETTE.muted);
    text(room.objective, FIELD.width / 2, 30, 17, PALETTE.gold, 'center');
    text(state.thief.carrying ? 'Loot secured — reach the GETAWAY door!' : 'Hold E at the case to crack it · E at ⚡ to hack a camera', FIELD.width / 2, 56, 14, PALETTE.muted, 'center');
    text(`TAKE ${money(take)}`, FIELD.width - 24, 30, 22, PALETTE.gold, 'right');
    text(`⏱ ${clock(state.elapsed)}   ● COINS ×${state.coins}`, FIELD.width - 24, 56, 15, PALETTE.text, 'right');
    // The big ALARM meter.
    const barX = 24;
    const barY = HUD_HEIGHT + 10;
    const barW = 420;
    const barH = 20;
    text('ALARM', barX, barY + 16, 16, state.alarm > 66 ? PALETTE.alarm : PALETTE.text);
    context.fillStyle = PALETTE.alarmTrack;
    context.fillRect(barX + 64, barY, barW, barH);
    const alarmFrac = state.alarm / 100;
    context.fillStyle = alarmFrac > 0.66 ? '#ff3b30' : alarmFrac > 0.33 ? '#f2b43c' : '#2fae5f';
    context.fillRect(barX + 64, barY, barW * alarmFrac, barH);
    context.strokeStyle = '#6b7280';
    context.lineWidth = 1.5;
    context.strokeRect(barX + 64, barY, barW, barH);
    text(`${Math.round(state.alarm)}%`, barX + 64 + barW + 10, barY + 16, 16, PALETTE.text);
    if (state.spotted && screen === SCREEN_PLAY) {
      const flash = Math.floor(state.elapsed * 6) % 2 === 0;
      if (flash) text('⚠ SPOTTED', barX + 64 + barW + 70, barY + 16, 18, PALETTE.alarm);
    }
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
    text(title, FIELD.width / 2, y + 78, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center');
  }

  /** Paint one frame: the room, then the HUD or a panel for the screen. */
  function draw(state, screen, best, totalTake) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor(state);
    drawRoom(state);
    drawConesAndActors(state);
    // Once a room is cleared its take is already banked in totalTake; before
    // that, the take on display is the banked total plus this room's take.
    const take = (screen === SCREEN_CLEAR || screen === SCREEN_PERFECT)
      ? totalTake
      : totalTake + state.take;
    if (screen === SCREEN_TITLE) {
      const lines = [
        'Three floors. Three treasures. One way out.',
        'Slip past the guards and their amber cones —',
        'red camera sweeps and blinking lasers raise the alarm.',
        'Hold E to crack the case · E at ⚡ hacks a camera ·',
        'click to toss a coin and lure a guard · Shift sneaks · P pauses.',
        '',
        `Best take yet: ${money(best)}`,
      ];
      drawPanel('THE MERIDIAN HEIST', lines, 'Press Space or click to begin the heist');
      return;
    }
    drawHud(state, screen, take);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      const lines = [
        `${state.room.name} cleared — ${money(state.take)} this room.`,
        `Total take so far: ${money(take)}`,
        state.roomIndex + 1 < 3 ? 'The next floor is guarded harder.' : '',
      ];
      drawPanel('ROOM CLEAR', lines, state.roomIndex + 1 < 3 ? 'Press Space for the next floor' : 'Press Space to finish');
    } else if (screen === SCREEN_CAUGHT) {
      const lines = state.caughtReason === 'lockdown'
        ? ['The alarm hit 100% — the Meridian went into lockdown.', 'The vault doors sealed with you inside.']
        : ['A guard caught you in the open.', 'Suspicion is fair warning: break line of sight.'];
      drawPanel('CAUGHT', lines, 'Press Space to try the room again');
    } else if (screen === SCREEN_PERFECT) {
      const lines = [
        `You walked out of the Meridian with ${money(totalTake)}.`,
        'Three floors, three treasures, one clean getaway.',
        `Best take yet: ${money(best)}`,
      ];
      drawPanel('PERFECT HEIST', lines, 'Press Space to run it again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, toCanvas };
}
