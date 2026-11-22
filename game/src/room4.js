// The fourth floor of the Meridian Heist: the rooftop at dusk.
//
// The Meridian Star — $750,000, the biggest prize in the building — sits in
// a glass case under the open sky. The roof is wide open: no long interior
// walls, only air-conditioning units to hide behind and one skylight to
// cross. Three guards work the roof, two cameras sweep from the parapet,
// and a single laser cuts the approach to the case. Waypoint legs were
// picked so no patrol leg crosses an AC unit or a case.
//
// Coordinates live inside BOUNDS (x 16..1264, y 96..704), same as the other
// rooms. Angles are radians, 0 = east, PI/2 = south (down the screen).

export const ROOM4 = {
  name: 'The Meridian Rooftop',
  floor: 'Floor 4 · Rooftop',
  objective: 'Steal the Meridian Star — $750,000',
  loot: { x: 590, y: 140, w: 100, h: 60, value: 750000, label: 'MERIDIAN STAR', kind: 'star' },
  start: { x: 640, y: 620 },
  exit: { x: 600, y: 676, w: 80, h: 28 },
  walls: [
    // AC units: solid cover on an otherwise open roof.
    { x: 240, y: 300, w: 90, h: 60 },
    { x: 950, y: 300, w: 90, h: 60 },
    // The skylight frame the thief has to slip around.
    { x: 560, y: 420, w: 160, h: 24 },
  ],
  cases: [
    { x: 300, y: 180, w: 80, h: 50 },
    { x: 900, y: 180, w: 80, h: 50 },
  ],
  sideLoot: [
    { x: 180, y: 200, value: 5000, taken: false },
    { x: 1100, y: 200, value: 5000, taken: false },
    { x: 180, y: 600, value: 5000, taken: false },
    { x: 1100, y: 600, value: 5000, taken: false },
    // Below the laser line, above the skylight frame: a pouch that tempts
    // the thief to linger where the middle guard patrols.
    { x: 640, y: 380, value: 5000, taken: false },
  ],
  guards: [
    {
      waypoints: [
        [380, 250], [380, 550], [520, 550], [520, 250],
      ],
    },
    {
      // The right guard works the lower roof, well clear of the case: when
      // the alarm goes off it still has a run to the Meridian Star, so the
      // thief gets its head start instead of an ambush at the case.
      waypoints: [
        [900, 420], [900, 620], [800, 620], [800, 420],
      ],
    },
    {
      waypoints: [
        [640, 480], [480, 480], [480, 640], [800, 640], [800, 480],
      ],
    },
  ],
  cameras: [
    { x: 320, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 0.7 },
    { x: 960, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 2.2 },
  ],
  junctions: [
    { x: 380, y: 112, camera: 0 },
    { x: 900, y: 112, camera: 1 },
  ],
  lasers: [
    { x1: 420, y1: 300, x2: 860, y2: 300, phase: 0.5, period: 2.8, onFrac: 0.57 },
  ],
};
