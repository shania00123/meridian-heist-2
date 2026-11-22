// Second routes: a vent crawlspace in every room.
//
// Each room has two ways to the loot: the open floor, where every cone can
// find the thief, and a vent — a narrow service crawlspace along one wall,
// from near the start door up to near the loot case. Inside a vent the
// thief is hidden from every guard and camera, but crawling is slow: the
// thief moves at sneak speed while inside, so the safe route costs time
// and the fast route costs nerve.
//
// A vent is a rectangle of floor plus its two ends. The entry sits near the
// room's start, the exit near the loot; the autopilot and the player both
// walk in at one end and out at the other. Vents are indexed by room, in
// the same order as ROOMS.

export const VENTS = [
  // Room 1 — Gallery: the west service vent, along the left wall.
  { x: 40, y: 150, w: 60, h: 500, entry: { x: 70, y: 600 }, exit: { x: 70, y: 170 } },
  // Room 2 — Vault: the east service vent, along the right wall.
  { x: 1180, y: 150, w: 60, h: 500, entry: { x: 1210, y: 600 }, exit: { x: 1210, y: 170 } },
  // Room 3 — Penthouse: the west service vent, along the left wall.
  { x: 40, y: 150, w: 60, h: 500, entry: { x: 70, y: 600 }, exit: { x: 70, y: 170 } },
  // Room 4 — Rooftop: the east service vent, along the right parapet.
  { x: 1180, y: 150, w: 60, h: 500, entry: { x: 1210, y: 600 }, exit: { x: 1210, y: 170 } },
];

/** The vent of room `index`, or null when the room has none. */
export function ventForRoom(index) {
  return VENTS[index] ?? null;
}

/** True when the point (x, y) is inside the vent's crawlspace. A thief
 * whose centre is inside the vent is hidden; one hanging halfway out of
 * its mouth is not. */
export function pointInVent(vent, x, y) {
  if (!vent) return false;
  return x >= vent.x && x <= vent.x + vent.w && y >= vent.y && y <= vent.y + vent.h;
}
