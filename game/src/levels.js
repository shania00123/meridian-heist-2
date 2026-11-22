// The three rooms of the Meridian Heist. Each room is one floor of the
// Meridian: walls and display cases block movement and line of sight, guards
// walk waypoint loops, cameras sweep from the walls, lasers blink across the
// approaches, and the GETAWAY door waits at the bottom. Waypoint legs were
// picked so no patrol leg crosses a wall or a case.
//
// The fourth floor — the rooftop — lives in room4.js and is registered
// below, so the list below stays the three interior floors.
//
// Coordinates live inside BOUNDS (x 16..1264, y 96..704); the HUD strip sits
// above y 88. Angles are radians, 0 = east, PI/2 = south (down the screen).

import { ROOM4 } from './room4.js';

export const ROOMS = [
  {
    name: 'The Meridian Gallery',
    floor: 'Floor 1 · Gallery',
    objective: 'Steal the Meridian Diamond — $250,000',
    loot: { x: 590, y: 140, w: 100, h: 60, value: 250000, label: 'DIAMOND', kind: 'diamond' },
    start: { x: 640, y: 620 },
    exit: { x: 600, y: 676, w: 80, h: 28 },
    walls: [
      { x: 430, y: 180, w: 24, h: 220 },
      { x: 850, y: 340, w: 24, h: 220 },
      { x: 560, y: 300, w: 200, h: 24 },
    ],
    cases: [
      { x: 560, y: 440, w: 90, h: 50 },
      { x: 700, y: 440, w: 90, h: 50 },
    ],
    sideLoot: [
      { x: 180, y: 200, value: 5000, taken: false },
      { x: 1100, y: 200, value: 5000, taken: false },
      { x: 180, y: 600, value: 5000, taken: false },
      { x: 1100, y: 600, value: 5000, taken: false },
    ],
    guards: [
      {
        waypoints: [
          [300, 320], [300, 560], [640, 560], [640, 420], [300, 420],
        ],
      },
      {
        waypoints: [
          [1020, 220], [1020, 600], [920, 600], [920, 220],
        ],
      },
    ],
    cameras: [
      { x: 640, y: 104, baseAngle: Math.PI / 2, sweep: 0.95, phase: 0 },
    ],
    junctions: [
      { x: 700, y: 112, camera: 0 },
    ],
    lasers: [
      { x1: 480, y1: 380, x2: 800, y2: 380, phase: 0.25, period: 2.8, onFrac: 0.57 },
    ],
  },
  {
    name: 'Aurelia Vault',
    floor: 'Floor 2 · Vault',
    objective: 'Steal the Aurelia Core — $400,000',
    loot: { x: 590, y: 140, w: 100, h: 60, value: 400000, label: 'AURELIA CORE', kind: 'core' },
    start: { x: 640, y: 620 },
    exit: { x: 600, y: 676, w: 80, h: 28 },
    walls: [
      { x: 300, y: 160, w: 24, h: 260 },
      { x: 980, y: 320, w: 24, h: 260 },
      { x: 520, y: 460, w: 300, h: 24 },
    ],
    cases: [
      { x: 560, y: 300, w: 80, h: 50 },
      { x: 700, y: 300, w: 80, h: 50 },
    ],
    sideLoot: [
      { x: 180, y: 200, value: 5000, taken: false },
      { x: 1100, y: 200, value: 5000, taken: false },
      { x: 180, y: 620, value: 5000, taken: false },
      { x: 1100, y: 620, value: 5000, taken: false },
    ],
    guards: [
      {
        waypoints: [
          [250, 560], [250, 480], [480, 480], [480, 260],
        ],
      },
      {
        waypoints: [
          [1040, 180], [1040, 620], [880, 620], [880, 180],
        ],
      },
    ],
    cameras: [
      { x: 320, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 1.4 },
      { x: 960, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 2.6 },
    ],
    junctions: [
      { x: 380, y: 112, camera: 0 },
      { x: 900, y: 112, camera: 1 },
    ],
    lasers: [
      { x1: 520, y1: 220, x2: 520, y2: 400, phase: 0.0, period: 2.8, onFrac: 0.57 },
      { x1: 760, y1: 220, x2: 760, y2: 400, phase: 0.9, period: 2.8, onFrac: 0.57 },
      { x1: 420, y1: 520, x2: 860, y2: 520, phase: 1.8, period: 3.4, onFrac: 0.5 },
    ],
  },
  {
    name: 'Sky Penthouse',
    floor: 'Floor 3 · Penthouse',
    objective: 'Steal the Sky Crown — $600,000',
    loot: { x: 590, y: 140, w: 100, h: 60, value: 600000, label: 'SKY CROWN', kind: 'crown' },
    start: { x: 640, y: 620 },
    exit: { x: 600, y: 676, w: 80, h: 28 },
    walls: [
      { x: 400, y: 140, w: 24, h: 240 },
      { x: 880, y: 360, w: 24, h: 240 },
      { x: 540, y: 520, w: 200, h: 24 },
    ],
    cases: [
      { x: 560, y: 380, w: 90, h: 50 },
      { x: 700, y: 380, w: 90, h: 50 },
    ],
    sideLoot: [
      { x: 180, y: 200, value: 5000, taken: false },
      { x: 1100, y: 200, value: 5000, taken: false },
      { x: 180, y: 620, value: 5000, taken: false },
      { x: 1100, y: 620, value: 5000, taken: false },
      { x: 480, y: 180, value: 5000, taken: false },
      { x: 800, y: 180, value: 5000, taken: false },
    ],
    guards: [
      {
        waypoints: [
          [220, 240], [220, 520], [420, 520],
        ],
      },
      {
        waypoints: [
          [1060, 240], [1060, 620], [940, 620], [940, 240],
        ],
      },
      {
        waypoints: [
          [560, 460], [460, 460], [460, 640], [760, 640], [760, 460],
        ],
      },
    ],
    cameras: [
      { x: 300, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 0.5 },
      { x: 980, y: 104, baseAngle: Math.PI / 2, sweep: 0.85, phase: 2.0 },
      { x: 24, y: 320, baseAngle: 0, sweep: 0.8, phase: 3.1 },
      { x: 1256, y: 320, baseAngle: Math.PI, sweep: 0.8, phase: 4.2 },
    ],
    junctions: [
      { x: 360, y: 112, camera: 0 },
      { x: 920, y: 112, camera: 1 },
      { x: 52, y: 380, camera: 2 },
      { x: 1188, y: 380, camera: 3 },
    ],
    lasers: [
      { x1: 640, y1: 220, x2: 640, y2: 350, phase: 0.4, period: 2.8, onFrac: 0.57 },
      { x1: 300, y1: 580, x2: 980, y2: 580, phase: 1.5, period: 3.4, onFrac: 0.5 },
    ],
  },
  // Floor 4 — the rooftop, defined in room4.js.
  ROOM4,
];

/** Total value on the table across all three rooms (loot + side loot). */
export function totalPossibleTake() {
  let sum = 0;
  for (const room of ROOMS) {
    sum += room.loot.value;
    for (const item of room.sideLoot) sum += item.value;
  }
  return sum;
}
