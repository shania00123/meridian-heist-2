// Tools with a cost: a smoke bomb that blinds cones and an EMP pulse that
// kills every camera for a few seconds. Both are scarce on purpose — one
// smoke per room, one EMP per run — so spending one is a decision, not a
// habit. A smoke cloud is a disc of thick grey air: any guard or camera
// whose line of sight crosses it cannot see the thief inside or behind it.
// An EMP shuts every camera down, but the surge trips the alarm.
//
// This file holds no drawing and no browser in it, only state and pure
// tests, so the world can call it from step() and the renderer can read it.

export const SMOKE_RADIUS = 90;
export const SMOKE_SECONDS = 4;
export const SMOKE_PER_ROOM = 1;
export const EMP_SECONDS = 6;
export const EMP_ALARM_COST = 10;
export const EMP_PER_RUN = 1;

/** Fresh tool state for a run: one smoke (refilled per room) and one EMP. */
export function createToolState() {
  return {
    smoke: SMOKE_PER_ROOM,
    emp: EMP_PER_RUN,
    smokeClouds: [],
    empUntil: -1,
  };
}

/** A new room refills the smoke and clears the air; the EMP stays spent. */
export function resetRoomTools(tools) {
  tools.smoke = SMOKE_PER_ROOM;
  tools.smokeClouds = [];
  tools.empUntil = -1;
}

/** A new run refills everything, EMP included. */
export function resetRunTools(tools) {
  tools.emp = EMP_PER_RUN;
  resetRoomTools(tools);
}

/** Drop a smoke bomb at (x, y). False when the thief is out of smoke. */
export function trySmoke(tools, x, y) {
  if (tools.smoke <= 0) return false;
  tools.smoke -= 1;
  tools.smokeClouds.push({ x, y, radius: SMOKE_RADIUS, ttl: SMOKE_SECONDS });
  return true;
}

/** Fire the EMP at `elapsed` seconds. False when it is already spent. */
export function tryEmp(tools, elapsed) {
  if (tools.emp <= 0) return false;
  tools.emp -= 1;
  tools.empUntil = elapsed + EMP_SECONDS;
  return true;
}

/** Age the smoke clouds; expired ones clear. */
export function updateTools(tools, dt) {
  for (let i = tools.smokeClouds.length - 1; i >= 0; i -= 1) {
    tools.smokeClouds[i].ttl -= dt;
    if (tools.smokeClouds[i].ttl <= 0) tools.smokeClouds.splice(i, 1);
  }
}

/** True while the EMP blackout still holds at `elapsed` seconds. */
export function empActive(tools, elapsed) {
  return tools.empUntil >= 0 && elapsed < tools.empUntil;
}

/** Seconds of EMP blackout left at `elapsed`, or 0 when it has ended. */
export function empSecondsLeft(tools, elapsed) {
  return empActive(tools, elapsed) ? tools.empUntil - elapsed : 0;
}

/** True when the segment (x1, y1) → (x2, y2) crosses any smoke cloud.
 * A cloud hides the thief behind it as well as inside it: a guard on the
 * far side of the smoke cannot see through, even at point-blank range. */
export function smokeBlocks(tools, x1, y1, x2, y2) {
  for (const cloud of tools.smokeClouds) {
    if (distanceToSegment(cloud.x, cloud.y, x1, y1, x2, y2) < cloud.radius) return true;
  }
  return false;
}

/** True when the point (x, y) sits inside a smoke cloud. */
export function pointInSmoke(tools, x, y) {
  for (const cloud of tools.smokeClouds) {
    if (Math.hypot(x - cloud.x, y - cloud.y) < cloud.radius) return true;
  }
  return false;
}

/** Distance from point (px, py) to the segment a→b. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
