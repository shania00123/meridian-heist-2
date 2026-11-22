// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by an
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.
//
// The autopilot plans on a coarse grid with Dijkstra: every cell costs 1 plus
// a danger price for standing inside a guard or camera cone or near a guard,
// so the route prefers the safe shadows. It hacks one camera first, cracks
// the case, then (for the end scene) walks out through the GETAWAY door. When
// a guard's suspicion climbs past 0.3 it backs away from that guard until the
// heat is off, then replans.
import { BOUNDS, CAMERA, STEP, THIEF } from './config.js';
import { EVENT_CAUGHT, EVENT_CLEAR, EVENT_LOOT } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const CELL = 40;
const START_SECONDS = 5;
const PLAY_SECONDS = 90;
const COVER_LIMIT_SECONDS = 150;
const END_LIMIT_SECONDS = 600;
const RETREAT_SECONDS = 2.0;
const COLS = Math.floor(BOUNDS.width / CELL);
const ROWS = Math.floor(BOUNDS.height / CELL);

function cellCenter(col, row) {
  return {
    x: BOUNDS.x + col * CELL + CELL / 2,
    y: BOUNDS.y + row * CELL + CELL / 2,
  };
}

function cellOf(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor((x - BOUNDS.x) / CELL))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor((y - BOUNDS.y) / CELL))),
  };
}

function cellKey(col, row) {
  return row * COLS + col;
}

/**
 * Cheapest path from (fromX, fromY) to (toX, toY) as world points, or null.
 * Blocked cells are walls and cases (with a margin); cone cells cost extra.
 * When the goal cell itself is blocked (it sits inside a case's margin, as a
 * loot case's approach point can), the nearest free cell to it is used.
 */
function planPath(world, fromX, fromY, toX, toY) {
  const start = cellOf(fromX, fromY);
  let goal = cellOf(toX, toY);
  if (world.pointBlocked(cellCenter(goal.col, goal.row).x, cellCenter(goal.col, goal.row).y, THIEF.radius + 6)) {
    // The goal cell sits inside a case's margin: take the nearest free cell
    // to the target, strongly preferring one with a clear line to it — a
    // cell on the far side of the case would strand the thief behind glass.
    let found = null;
    let foundScore = Infinity;
    for (let ring = 1; ring <= 4; ring += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        for (let dr = -ring; dr <= ring; dr += 1) {
          if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
          const col = goal.col + dc;
          const row = goal.row + dr;
          if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
          const point = cellCenter(col, row);
          if (world.pointBlocked(point.x, point.y, THIEF.radius + 6)) continue;
          const clear = world.lineOfSight(point.x, point.y, toX, toY);
          const score = Math.hypot(point.x - toX, point.y - toY) + (clear ? 0 : 300);
          if (score < foundScore) {
            foundScore = score;
            found = { col, row };
          }
        }
      }
    }
    if (!found) return null;
    goal = found;
  }
  const startKey = cellKey(start.col, start.row);
  const goalKey = cellKey(goal.col, goal.row);
  const dist = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [{ key: startKey, cost: 0, col: start.col, row: start.row }];
  const closed = new Set();

  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].cost < open[bestIndex].cost) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    if (current.key === goalKey) break;
    const neighbours = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];
    for (const [dc, dr] of neighbours) {
      const col = current.col + dc;
      const row = current.row + dr;
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
      const key = cellKey(col, row);
      if (closed.has(key)) continue;
      const point = cellCenter(col, row);
      if (world.pointBlocked(point.x, point.y, THIEF.radius + 6)) continue;
      const stepCost = (dc !== 0 && dr !== 0 ? 1.41 : 1) + world.coneDangerAt(point.x, point.y) * 0.35;
      const nextCost = current.cost + stepCost;
      if (nextCost < (dist.get(key) ?? Infinity)) {
        dist.set(key, nextCost);
        prev.set(key, current.key);
        open.push({ key, cost: nextCost, col, row });
      }
    }
  }
  if (!dist.has(goalKey)) return null;
  const path = [];
  let key = goalKey;
  while (key !== startKey) {
    const col = key % COLS;
    const row = Math.floor(key / COLS);
    path.unshift(cellCenter(col, row));
    key = prev.get(key);
    if (key === undefined) return null;
  }
  // Drop waypoints the thief can reach in a straight, unblocked line: a leg
  // is kept only when sampling along it finds a blocked point.
  const smoothed = [];
  let anchor = { x: fromX, y: fromY };
  function legClear(ax, ay, bx, by) {
    const dist = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(dist / 10));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      if (world.pointBlocked(ax + (bx - ax) * t, ay + (by - ay) * t, THIEF.radius + 4)) return false;
    }
    return true;
  }
  for (let i = 0; i < path.length; i += 1) {
    const next = path[i + 1];
    if (next && legClear(anchor.x, anchor.y, next.x, next.y)) continue;
    smoothed.push(path[i]);
    anchor = path[i];
  }
  if (smoothed.length === 0) smoothed.push({ x: toX, y: toY });
  return smoothed;
}

/** Steer the thief toward a point: the {dx, dy, use} input for one step. */
function steerToward(world, tx, ty, use, sneak = false) {
  const thief = world.state.thief;
  const dx = tx - thief.x;
  const dy = ty - thief.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { dx: 0, dy: 0, sneak, use: !!use, throwAt: null };
  return { dx: dx / dist, dy: dy / dist, sneak, use: !!use, throwAt: null };
}

function hottestGuard(world) {
  let hottest = null;
  for (const guard of world.state.guards) {
    if (guard.suspicion > 0.3 && (!hottest || guard.suspicion > hottest.suspicion)) hottest = guard;
  }
  return hottest;
}

/** The hiding spot farthest from `guard`: corners and the start, so a
 * retreat runs away from the guard instead of into its patrol. */
function safestSpot(world, guard) {
  const spots = [
    { x: world.state.room.start.x, y: world.state.room.start.y },
    { x: 110, y: 180 },
    { x: 1170, y: 180 },
    { x: 110, y: 620 },
    { x: 1170, y: 620 },
  ];
  let bestSpot = spots[0];
  let bestDist = -1;
  for (const spot of spots) {
    const d = Math.hypot(spot.x - guard.x, spot.y - guard.y);
    if (d > bestDist) {
      bestDist = d;
      bestSpot = spot;
    }
  }
  return bestSpot;
}

/** True when the thief stands inside any live camera cone. */
function thiefInCameraCone(world) {
  const thief = world.state.thief;
  for (const camera of world.state.cameras) {
    if (camera.hacked) continue;
    const dx = thief.x - camera.x;
    const dy = thief.y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA.range) continue;
    const angle = Math.atan2(dy, dx);
    let diff = angle - camera.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > CAMERA.halfAngle) continue;
    if (world.lineOfSight(camera.x, camera.y, thief.x, thief.y)) return true;
  }
  return false;
}

/**
 * The autopilot's tool use: smoke when a guard is hot on the thief's tail,
 * EMP (end scene only, where the walk out matters more than the drama)
 * when a live camera cone covers the thief. The cover and play scenes keep
 * their cones live for the frame.
 */
function autopilotTools(world, sceneName) {
  const tools = world.state.tools;
  let smoke = false;
  let emp = false;
  const hot = hottestGuard(world);
  if (hot && hot.suspicion > 0.6 && tools.smoke > 0) smoke = true;
  if (sceneName === 'end' && tools.emp > 0 && thiefInCameraCone(world)) emp = true;
  return { smoke, emp };
}

/**
 * Set `world` to the named scene (start, play, cover or end; any other name is
 * start) and return the screen to draw over it and the best take to show.
 * `roomIndex` stages a later room instead of the first (for verification).
 */
export function stageShot(name, world, roomIndex = 0) {
  world.reset();
  if (roomIndex > 0) world.loadRoom(roomIndex);
  if (name !== 'play' && name !== 'end' && name !== 'cover') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { dx: 0, dy: 0, sneak: false, use: false, throwAt: null }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'cover' ? COVER_LIMIT_SECONDS : PLAY_SECONDS;
  // The play and cover scenes keep the camera live, so its red cone sweeps
  // the frame; the end scene hacks it first, for a reliable walk to the
  // GETAWAY door.
  let phase = name === 'play' || name === 'cover' ? 'loot' : 'hack';
  let path = null;
  let pathIndex = 0;
  let replanIn = 0;
  let retreatUntil = -1;
  let retreatPath = null;
  let retreatIndex = 0;
  let retreatHome = null;
  let played = 0;
  let events = 0;

  function replan(target) {
    path = planPath(world, world.state.thief.x, world.state.thief.y, target.x, target.y);
    pathIndex = 0;
    replanIn = 0.5;
  }

  function targetForPhase() {
    const room = world.state.room;
    if (phase === 'hack') {
      // Hack the nearest junction, not the first listed: crossing the whole
      // room for a far camera is how a thief gets caught.
      let nearest = null;
      let nearestDist = Infinity;
      for (const junction of room.junctions) {
        if (world.state.cameras[junction.camera].hacked) continue;
        const d = Math.hypot(junction.x - world.state.thief.x, junction.y - world.state.thief.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = junction;
        }
      }
      if (nearest) return { x: nearest.x, y: nearest.y };
      return { x: room.loot.x + room.loot.w / 2, y: room.loot.y + room.loot.h / 2 + 46 };
    }
    if (phase === 'loot') {
      return { x: room.loot.x + room.loot.w / 2, y: room.loot.y + room.loot.h / 2 + 46 };
    }
    return { x: room.exit.x + room.exit.w / 2, y: room.exit.y + 8 };
  }

  for (let i = 0; i < limit / STEP; i += 1) {
    const state = world.state;
    if (state.phase !== 'play') break;
    played += STEP;
    replanIn -= STEP;

    // A hot guard means fall back: run for the hiding spot farthest from
    // that guard until the heat is off, then replan. The retreat follows a
    // planned path, so walls break the guard's line of sight on the way.
    // Never during the getaway, though: once the van timer is running the
    // only correct move is the door, and retreating strands the thief.
    const hot = hottestGuard(world);
    if (hot && !state.getaway.active && state.elapsed > retreatUntil) {
      retreatUntil = state.elapsed + RETREAT_SECONDS;
      const home = safestSpot(world, hot);
      retreatPath = planPath(world, state.thief.x, state.thief.y, home.x, home.y);
      retreatIndex = 0;
      retreatHome = home;
    }
    if (state.elapsed < retreatUntil && hot && !state.getaway.active) {
      let input = { dx: 0, dy: 0, sneak: false, use: false, throwAt: null };
      if (retreatPath && retreatIndex < retreatPath.length) {
        const waypoint = retreatPath[retreatIndex];
        if (Math.hypot(waypoint.x - state.thief.x, waypoint.y - state.thief.y) < 14) retreatIndex += 1;
        else input = steerToward(world, waypoint.x, waypoint.y, false);
      } else if (retreatHome) {
        input = steerToward(world, retreatHome.x, retreatHome.y, false);
      }
      const retreatTools = autopilotTools(world, name);
      input.smoke = retreatTools.smoke;
      input.emp = retreatTools.emp;
      events = world.step(STEP, input, false);
      if (events & EVENT_CAUGHT) break;
      continue;
    }
    retreatPath = null;

    const target = targetForPhase();
    if (!path || replanIn <= 0) replan(target);
    let input = { dx: 0, dy: 0, sneak: false, use: false, throwAt: null };
    // Sneak whenever a guard is already wary or the next step is risky:
    // sneaking halves the guard's vision range and suspicion rise.
    const wary = world.state.guards.some((g) => g.suspicion > 0.05);
    // Close to the loot case, steer straight at the crack point under it: the
    // grid's nearest free cell can sit just outside cracking range, and the
    // narrow band between the case and the wall below it needs a direct line.
    if (phase === 'loot' && !state.thief.carrying) {
      const lootCx = state.room.loot.x + state.room.loot.w / 2;
      const lootCy = state.room.loot.y + state.room.loot.h / 2;
      const toCase = Math.hypot(lootCx - state.thief.x, lootCy - state.thief.y);
      const crackPointClear = world.lineOfSight(state.thief.x, state.thief.y, lootCx, lootCy + 46);
      if (toCase < 130 && crackPointClear) {
        input = steerToward(world, lootCx, lootCy + 46, toCase < 64);
        if (toCase < 64) input.use = true;
      } else if (path && pathIndex < path.length) {
        const waypoint = path[pathIndex];
        const d = Math.hypot(waypoint.x - state.thief.x, waypoint.y - state.thief.y);
        if (d < 14) pathIndex += 1;
        else if (!state.getaway.active && world.coneDangerAt(waypoint.x, waypoint.y) > 50) {
          // The next step is under a live cone: hold still and let the
          // patrol sweep past instead of walking into it — unless the van
          // timer is running, when waiting strands the thief.
          input = { dx: 0, dy: 0, sneak: false, use: false, throwAt: null };
        } else input = steerToward(world, waypoint.x, waypoint.y, false,
          wary || world.coneDangerAt(waypoint.x, waypoint.y) > 25);
      }
    } else if (path && pathIndex < path.length) {
      const waypoint = path[pathIndex];
      const d = Math.hypot(waypoint.x - state.thief.x, waypoint.y - state.thief.y);
      if (d < 14) pathIndex += 1;
      else if (!state.getaway.active && world.coneDangerAt(waypoint.x, waypoint.y) > 50) {
        // The next step is under a live cone: hold still and let the
        // patrol sweep past instead of walking into it — unless the van
        // timer is running, when waiting strands the thief.
        input = { dx: 0, dy: 0, sneak: false, use: false, throwAt: null };
      } else input = steerToward(world, waypoint.x, waypoint.y, false,
        wary || world.coneDangerAt(waypoint.x, waypoint.y) > 25);
    }
    // At the target: hold E to crack or hack.
    const atTarget = Math.hypot(target.x - state.thief.x, target.y - state.thief.y) < 46;
    if (atTarget && phase !== 'exit') input.use = true;

    const tools = autopilotTools(world, name);
    input.smoke = tools.smoke;
    input.emp = tools.emp;
    events = world.step(STEP, input, false);
    if (events & EVENT_CAUGHT) break;
    if (events & EVENT_LOOT) {
      if (name === 'play' || name === 'cover') break; // play/cover frame: loot in hand
      phase = 'exit';
      path = null;
    }
    // The cover stops the first time the thief enters the middle of the
    // room: the loot case still glows above, the cones sweep around the
    // thief, and the frame shows the whole heist at once — not the loot
    // moment, when the case is already empty.
    if (name === 'cover' && state.elapsed > 2 && state.thief.y < 480) break;
    if (phase === 'hack') {
      const open = state.room.junctions.find((j) => !state.cameras[j.camera].hacked);
      if (!open) {
        phase = 'loot';
        path = null;
      }
    }
    if (events & EVENT_CLEAR) break;
  }

  const cleared = world.state.phase === 'clear';
  const over = world.state.phase === 'caught';
  // After a clear, totalTake already banks this room's take; before one, the
  // take on display is the room's take so far.
  const shownTake = cleared ? world.state.totalTake : world.state.totalTake + world.state.take;
  return {
    screen: cleared ? SCREEN_CLEAR : over ? SCREEN_PLAY : SCREEN_PLAY,
    best: shownTake,
  };
}

// Exported for headless verification (the browser never calls it).
export { planPath };
