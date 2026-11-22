// The game's rules and state, with no drawing and no browser in it: the
// thief, the patrolling guards and their suspicion, the sweeping cameras, the
// blinking lasers, the alarm meter, cracking, hacking and the coin lure.
// step() advances one fixed step and returns what happened as bit flags, so
// the caller can react (and play sounds) without the world knowing about
// screens or sound. Nothing here allocates after createWorld returns.
import {
  ALARM, BOUNDS, CAMERA, COIN_COUNT, COIN_INVESTIGATE_SECONDS, COIN_LURE_RADIUS,
  CRACK_SECONDS, GUARD, HACK_SECONDS, LASER, THIEF,
} from './config.js';
import { ROOMS } from './levels.js';
import {
  EMP_ALARM_COST, createToolState, empActive, resetRoomTools,
  resetRunTools, smokeBlocks, tryEmp, trySmoke, updateTools,
} from './tools.js';
import { pointInVent, ventForRoom } from './routes.js';
import {
  GETAWAY_ALARM_RISE, GETAWAY_REACT_SECONDS, createGetawayState, rankForGetaway, startGetaway,
  updateGetaway,
} from './getaway.js';

export const EVENT_PICKUP = 1;
export const EVENT_LOOT = 2;
export const EVENT_HACK = 4;
export const EVENT_CLEAR = 8;
export const EVENT_CAUGHT = 16;
export const EVENT_SPOT = 32;
export const EVENT_LASER = 64;
export const EVENT_COIN = 128;
export const EVENT_SMOKE = 256;
export const EVENT_EMP = 512;

export const CAUGHT_GUARD = 'guard';
export const CAUGHT_LOCKDOWN = 'lockdown';
export const CAUGHT_VAN = 'van';

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment p→q crosses the rectangle r (slab test). */
export function segmentHitsRect(px, py, qx, qy, r) {
  const dx = qx - px;
  const dy = qy - py;
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (px < r.x || px > r.x + r.w) return false;
  } else {
    let t1 = (r.x - px) / dx;
    let t2 = (r.x + r.w - px) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (py < r.y || py > r.y + r.h) return false;
  } else {
    let t1 = (r.y - py) / dy;
    let t2 = (r.y + r.h - py) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** Distance from point (px, py) to the segment a→b. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export function createWorld(random) {
  const state = {
    roomIndex: 0,
    room: null,
    thief: { x: 0, y: 0, carrying: false, sneaking: false },
    guards: [],
    cameras: [],
    lasers: [],
    coins: COIN_COUNT,
    thrownCoin: null,
    tools: createToolState(),
    vent: null,
    getaway: createGetawayState(),
    caughtBy: null,
    alarm: 0,
    elapsed: 0,
    take: 0, // this room's take so far
    totalTake: 0, // take banked from cleared rooms
    crackProgress: 0,
    hackProgress: 0,
    hackTarget: -1,
    spotted: false,
    phase: 'play', // play | clear | caught
    caughtReason: null,
  };

  function blockers() {
    const room = state.room;
    return room.walls.concat(room.cases).concat([room.loot]);
  }

  function lineOfSight(x1, y1, x2, y2) {
    for (const r of blockers()) {
      if (segmentHitsRect(x1, y1, x2, y2, r)) return false;
    }
    return true;
  }

  /** Push a circle out of every solid rectangle and the room bounds. */
  function collide(circle, radius) {
    circle.x = clamp(circle.x, BOUNDS.x + radius, BOUNDS.x + BOUNDS.width - radius);
    circle.y = clamp(circle.y, BOUNDS.y + radius, BOUNDS.y + BOUNDS.height - radius);
    for (const r of blockers()) {
      const nearestX = clamp(circle.x, r.x, r.x + r.w);
      const nearestY = clamp(circle.y, r.y, r.y + r.h);
      const dx = circle.x - nearestX;
      const dy = circle.y - nearestY;
      const dist2 = dx * dx + dy * dy;
      if (dist2 >= radius * radius) continue;
      if (dist2 === 0) {
        // Dead centre inside the rectangle: push out along the shallow side.
        const left = circle.x - r.x;
        const right = r.x + r.w - circle.x;
        const top = circle.y - r.y;
        const bottom = r.y + r.h - circle.y;
        const min = Math.min(left, right, top, bottom);
        if (min === left) circle.x = r.x - radius;
        else if (min === right) circle.x = r.x + r.w + radius;
        else if (min === top) circle.y = r.y - radius;
        else circle.y = r.y + r.h + radius;
      } else {
        const dist = Math.sqrt(dist2);
        circle.x = nearestX + (dx / dist) * radius;
        circle.y = nearestY + (dy / dist) * radius;
      }
    }
  }

  function loadRoom(index) {
    const def = ROOMS[index];
    state.roomIndex = index;
    // A live copy: the definition stays pristine for the next reset.
    state.room = {
      ...def,
      sideLoot: def.sideLoot.map((item) => ({ ...item })),
      guards: def.guards.map((g) => ({ waypoints: g.waypoints.map((w) => [...w]) })),
      cameras: def.cameras.map((c) => ({ ...c })),
      junctions: def.junctions.map((j) => ({ ...j })),
      lasers: def.lasers.map((l) => ({ ...l })),
    };
    state.thief.x = def.start.x;
    state.thief.y = def.start.y;
    state.thief.carrying = false;
    state.guards = state.room.guards.map((g, gi) => ({
      x: g.waypoints[0][0],
      y: g.waypoints[0][1],
      waypoint: 1 % g.waypoints.length,
      suspicion: 0,
      mode: 'patrol',
      facing: 0,
      loseSight: 0,
      investigate: null,
      wait: 0,
      seedOffset: random() * Math.PI * 2,
      index: gi,
      // Where this guard last saw the thief: a chasing guard runs here,
      // not at the thief's live position, so smoke, vents and walls are
      // real counterplay instead of decoration.
      lastKnown: { x: g.waypoints[0][0], y: g.waypoints[0][1] },
      // Elapsed seconds until this guard starts running after being
      // alerted by the crack (it needs a moment to orient). 0 normally.
      reactUntil: 0,
    }));
    state.cameras = state.room.cameras.map((c) => ({
      ...c,
      angle: c.baseAngle,
      hacked: false,
    }));
    state.lasers = state.room.lasers.map((l) => ({ ...l, on: true, cooldown: 0 }));
    state.coins = COIN_COUNT;
    state.thrownCoin = null;
    state.alarm = 0;
    state.elapsed = 0;
    state.take = 0;
    state.crackProgress = 0;
    state.hackProgress = 0;
    state.hackTarget = -1;
    state.spotted = false;
    state.phase = 'play';
    state.caughtReason = null;
    state.vent = ventForRoom(index);
    resetRoomTools(state.tools);
    state.getaway = createGetawayState();
    state.caughtBy = null;
  }

  function reset() {
    state.totalTake = 0;
    resetRunTools(state.tools);
    loadRoom(0);
  }

  function moveToward(entity, tx, ty, speed, dt, radius) {
    const dx = tx - entity.x;
    const dy = ty - entity.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1e-6) return true;
    const step = Math.min(dist, speed * dt);
    entity.x += (dx / dist) * step;
    entity.y += (dy / dist) * step;
    entity.facing = Math.atan2(dy, dx);
    collide(entity, radius);
    return dist - step < 6;
  }

  function guardSeesThief(guard) {
    // A thief inside a vent is hidden, and smoke between the guard and the
    // thief blinds the cone — the guard cannot see through either.
    if (pointInVent(state.vent, state.thief.x, state.thief.y)) return { sees: false, dist: Infinity };
    if (smokeBlocks(state.tools, guard.x, guard.y, state.thief.x, state.thief.y)) return { sees: false, dist: Infinity };
    const dx = state.thief.x - guard.x;
    const dy = state.thief.y - guard.y;
    const dist = Math.hypot(dx, dy);
    // A sneaking thief is harder to spot: shorter range, slower suspicion.
    const range = state.thief.sneaking ? GUARD.visionRange * 0.64 : GUARD.visionRange;
    if (dist > range) return { sees: false, dist };
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(angle, guard.facing)) > GUARD.visionHalfAngle) return { sees: false, dist };
    if (!lineOfSight(guard.x, guard.y, state.thief.x, state.thief.y)) return { sees: false, dist };
    return { sees: true, dist };
  }

  function cameraSeesThief(camera) {
    if (camera.hacked) return false;
    // An EMP blackout blinds every camera; a vent hides the thief; smoke
    // between the camera and the thief blinds this cone.
    if (empActive(state.tools, state.elapsed)) return false;
    if (pointInVent(state.vent, state.thief.x, state.thief.y)) return false;
    if (smokeBlocks(state.tools, camera.x, camera.y, state.thief.x, state.thief.y)) return false;
    const dx = state.thief.x - camera.x;
    const dy = state.thief.y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA.range) return false;
    const angle = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(angle, camera.angle)) > CAMERA.halfAngle) return false;
    return lineOfSight(camera.x, camera.y, state.thief.x, state.thief.y);
  }

  /**
   * One fixed step. `input` is {dx, dy, sneak, use, throwAt}. With `harmless`
   * set (the title screen's backdrop) the room lives but nothing spots, trips
   * or catches the thief. Returns EVENT_* bit flags.
   */
  function step(dt, input, harmless) {
    let events = 0;
    if (state.phase !== 'play') return events;
    state.elapsed += dt;
    const thief = state.thief;

    // --- the thief ---------------------------------------------------------
    // Crawling through a vent is slow: the thief moves at sneak speed
    // inside one, whether sneaking or not.
    const inVent = pointInVent(state.vent, thief.x, thief.y);
    const speed = input.sneak || inVent ? THIEF.sneakSpeed : THIEF.walkSpeed;
    state.thief.sneaking = input.sneak || inVent;
    if (input.dx !== 0 || input.dy !== 0) {
      thief.x += input.dx * speed * dt;
      thief.y += input.dy * speed * dt;
      collide(thief, THIEF.radius);
    }

    // --- coin lure ---------------------------------------------------------
    if (input.throwAt && state.coins > 0 && !state.thrownCoin && !harmless) {
      state.coins -= 1;
      state.thrownCoin = { x: input.throwAt.x, y: input.throwAt.y, age: 0 };
      events |= EVENT_COIN;
      for (const guard of state.guards) {
        if (guard.mode !== 'chase' &&
            Math.hypot(guard.x - input.throwAt.x, guard.y - input.throwAt.y) < COIN_LURE_RADIUS) {
          guard.mode = 'investigate';
          guard.investigate = { x: input.throwAt.x, y: input.throwAt.y, wait: COIN_INVESTIGATE_SECONDS };
        }
      }
    }
    if (state.thrownCoin) {
      state.thrownCoin.age += dt;
      if (state.thrownCoin.age > 6) state.thrownCoin = null;
    }

    // --- tools -------------------------------------------------------------
    // One-shot presses: Q drops smoke at the thief's feet, F fires the EMP.
    // The EMP's surge trips the alarm the moment it goes off.
    if (!harmless) {
      if (input.smoke && trySmoke(state.tools, thief.x, thief.y)) events |= EVENT_SMOKE;
      if (input.emp && tryEmp(state.tools, state.elapsed)) {
        state.alarm = Math.min(ALARM.max, state.alarm + EMP_ALARM_COST);
        events |= EVENT_EMP;
      }
    }
    updateTools(state.tools, dt);

    // --- cameras -----------------------------------------------------------
    let cameraSeen = false;
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle + camera.sweep * Math.sin(state.elapsed * 1.1 + camera.phase);
      if (!harmless && cameraSeesThief(camera)) cameraSeen = true;
    }

    // --- lasers ------------------------------------------------------------
    for (const laser of state.lasers) {
      const cycle = (state.elapsed + laser.phase) % laser.period;
      laser.on = cycle < laser.period * laser.onFrac;
      if (laser.cooldown > 0) laser.cooldown -= dt;
      if (!harmless && laser.on && laser.cooldown <= 0 &&
          distanceToSegment(thief.x, thief.y, laser.x1, laser.y1, laser.x2, laser.y2) < THIEF.radius + 2) {
        state.alarm = Math.min(ALARM.max, state.alarm + LASER.alarmOnTrip);
        laser.cooldown = LASER.tripCooldown;
        events |= EVENT_LASER;
      }
    }

    // --- guards ------------------------------------------------------------
    for (const guard of state.guards) {
      const seen = harmless ? { sees: false, dist: Infinity } : guardSeesThief(guard);
      if (seen.sees) {
        const rise = seen.dist < 90 ? GUARD.suspicionRiseClose : GUARD.suspicionRise;
        guard.suspicion = Math.min(1, guard.suspicion + rise * (state.thief.sneaking ? 0.55 : 1) * dt);
        // The guard remembers exactly where it saw the thief.
        guard.lastKnown.x = state.thief.x;
        guard.lastKnown.y = state.thief.y;
        if (guard.suspicion >= 1 && guard.mode !== 'chase') {
          guard.mode = 'chase';
          guard.loseSight = 0;
          state.alarm = Math.min(ALARM.max, state.alarm + ALARM.spotBurst);
          events |= EVENT_SPOT;
        }
      } else {
        guard.suspicion = Math.max(0, guard.suspicion - GUARD.suspicionFall * dt);
      }

      if (guard.mode === 'chase') {
        if (seen.sees) guard.loseSight = 0;
        else {
          guard.loseSight += dt;
          // During the getaway the guards hunt until the thief is out: they
          // do not give up and drift back to patrol while the van waits.
          if (guard.loseSight > GUARD.loseSightSeconds && !state.getaway.active) {
            guard.mode = 'patrol';
            guard.suspicion = 0.5;
          }
        }
        // Chase the last known position, not the thief's live one: a guard
        // that lost sight runs to where it last saw the thief and looks.
        // A guard alerted by the crack stands and orients first.
        let arrived = false;
        if (state.elapsed >= guard.reactUntil) {
          arrived = moveToward(guard, guard.lastKnown.x, guard.lastKnown.y, GUARD.chaseSpeed, dt, GUARD.radius);
        }
        if (arrived && !seen.sees) {
          // Lost the trail at the last known spot: during the getaway the
          // guards cut off the GETAWAY door, the one way out.
          if (state.getaway.active) {
            guard.lastKnown.x = state.room.exit.x + state.room.exit.w / 2;
            guard.lastKnown.y = state.room.exit.y + state.room.exit.h / 2;
          }
        }
        if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < THIEF.catchRadius) {
          state.phase = 'caught';
          state.caughtReason = CAUGHT_GUARD;
          state.caughtBy = `Guard ${guard.index + 1}`;
          events |= EVENT_CAUGHT;
          return events;
        }
      } else if (guard.mode === 'investigate' && guard.investigate) {
        const target = guard.investigate;
        if (moveToward(guard, target.x, target.y, GUARD.patrolSpeed * 1.5, dt, GUARD.radius)) {
          target.wait -= dt;
          guard.facing += dt * 1.5;
          if (target.wait <= 0) {
            guard.mode = 'patrol';
            guard.investigate = null;
          }
        }
      } else {
        const waypoints = state.room.guards[guard.index].waypoints;
        const target = waypoints[guard.waypoint];
        if (moveToward(guard, target[0], target[1], GUARD.patrolSpeed, dt, GUARD.radius)) {
          guard.waypoint = (guard.waypoint + 1) % waypoints.length;
        }
      }
      // A suspicious guard stares at the thief instead of walking on.
      if (guard.mode === 'patrol' && guard.suspicion > 0.25 && seen.sees) {
        guard.facing = Math.atan2(thief.y - guard.y, thief.x - guard.x);
      }
    }

    // --- alarm -------------------------------------------------------------
    state.spotted = cameraSeen || state.guards.some((g) => g.mode === 'chase');
    if (!harmless) {
      if (cameraSeen) state.alarm = Math.min(ALARM.max, state.alarm + CAMERA.alarmPerSecond * dt);
      if (!state.spotted && state.crackProgress <= 0) {
        state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
      }
      if (state.alarm >= ALARM.max) {
        state.phase = 'caught';
        state.caughtReason = CAUGHT_LOCKDOWN;
        state.caughtBy = 'The alarm hit 100%';
        events |= EVENT_CAUGHT;
        return events;
      }
    }

    // --- cracking the loot case --------------------------------------------
    const loot = state.room.loot;
    const lootCx = loot.x + loot.w / 2;
    const lootCy = loot.y + loot.h / 2;
    const nearLoot = Math.hypot(thief.x - lootCx, thief.y - lootCy) < 64;
    if (!harmless && !thief.carrying && nearLoot && input.use) {
      state.crackProgress += dt / CRACK_SECONDS;
      state.alarm = Math.min(ALARM.max, state.alarm + ALARM.crackPerSecond * dt);
      if (state.crackProgress >= 1) {
        thief.carrying = true;
        state.take += loot.value;
        state.crackProgress = 0;
        events |= EVENT_LOOT;
        // The loud part starts: the alarm jumps, every guard turns and
        // runs for the thief, and the getaway van starts its 20-second wait.
        // The alarm tells every guard where the break-in is, so they run
        // for the case first — the thief's head start is the race. A guard
        // that was not already chasing needs a moment to orient before it
        // runs; one already on the thief's tail does not.
        startGetaway(state.getaway);
        state.alarm = Math.min(ALARM.max, state.alarm + GETAWAY_ALARM_RISE);
        for (const guard of state.guards) {
          if (guard.mode !== 'chase') guard.reactUntil = state.elapsed + GETAWAY_REACT_SECONDS;
          guard.mode = 'chase';
          guard.loseSight = 0;
          guard.lastKnown.x = thief.x;
          guard.lastKnown.y = thief.y;
        }
      }
    } else if (state.crackProgress > 0) {
      state.crackProgress = Math.max(0, state.crackProgress - dt * 2);
    }

    // --- hacking a camera junction -----------------------------------------
    let nearestJunction = -1;
    let nearestDist = 52;
    state.room.junctions.forEach((junction, index) => {
      if (state.cameras[junction.camera].hacked) return;
      const d = Math.hypot(thief.x - junction.x, thief.y - junction.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestJunction = index;
      }
    });
    state.hackTarget = nearestJunction;
    if (!harmless && nearestJunction >= 0 && input.use && !nearLoot) {
      state.hackProgress += dt / HACK_SECONDS;
      if (state.hackProgress >= 1) {
        state.cameras[state.room.junctions[nearestJunction].camera].hacked = true;
        state.hackProgress = 0;
        state.hackTarget = -1;
        events |= EVENT_HACK;
      }
    } else if (state.hackProgress > 0) {
      state.hackProgress = Math.max(0, state.hackProgress - dt * 2);
    }

    // --- side loot -----------------------------------------------------------
    for (const item of state.room.sideLoot) {
      if (!item.taken && Math.hypot(thief.x - item.x, thief.y - item.y) < 28) {
        item.taken = true;
        state.take += item.value;
        events |= EVENT_PICKUP;
      }
    }

    // --- getaway -------------------------------------------------------------
    // The door triggers when the thief's centre reaches it (a radius of grace
    // around the door frame, so stopping just at its edge still counts).
    // The van timer is checked first: reaching the door on the very step the
    // van leaves still counts as an escape.
    const exit = state.room.exit;
    if (thief.carrying && thief.x > exit.x - 12 && thief.x < exit.x + exit.w + 12 &&
        thief.y > exit.y - 14 && thief.y < exit.y + exit.h + 14) {
      state.getaway.rank = rankForGetaway(state.alarm, state.getaway.timer);
      state.getaway.active = false;
      state.phase = 'clear';
      state.totalTake += state.take;
      events |= EVENT_CLEAR;
    } else if (state.getaway.active && updateGetaway(state.getaway, dt)) {
      // The van left without the thief: stranded inside the Meridian.
      state.phase = 'caught';
      state.caughtReason = CAUGHT_VAN;
      state.caughtBy = 'The getaway van';
      events |= EVENT_CAUGHT;
      return events;
    }

    return events;
  }

  /** True when point (x, y) is inside a solid rectangle (for pathfinding). */
  function pointBlocked(x, y, margin) {
    if (x < BOUNDS.x + margin || x > BOUNDS.x + BOUNDS.width - margin ||
        y < BOUNDS.y + margin || y > BOUNDS.y + BOUNDS.height - margin) return true;
    for (const r of blockers()) {
      if (x > r.x - margin && x < r.x + r.w + margin &&
          y > r.y - margin && y < r.y + r.h + margin) return true;
    }
    return false;
  }

  /** Rough danger of standing at (x, y): 0 safe, higher inside a live cone. */
  function coneDangerAt(x, y) {
    let danger = 0;
    for (const guard of state.guards) {
      const dx = x - guard.x;
      const dy = y - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist < GUARD.visionRange &&
          Math.abs(angleDifference(Math.atan2(dy, dx), guard.facing)) < GUARD.visionHalfAngle) {
        danger += dist < 110 ? 90 : 45;
      }
      if (dist < 70) danger += 60;
    }
    for (const camera of state.cameras) {
      if (camera.hacked) continue;
      const dx = x - camera.x;
      const dy = y - camera.y;
      const dist = Math.hypot(dx, dy);
      if (dist < CAMERA.range &&
          Math.abs(angleDifference(Math.atan2(dy, dx), camera.angle)) < CAMERA.halfAngle) {
        danger += 40;
      }
    }
    return danger;
  }

  loadRoom(0);
  return {
    state, reset, loadRoom, step,
    blockers, lineOfSight, pointBlocked, coneDangerAt,
  };
}
