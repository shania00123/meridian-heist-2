// The Meridian Heist — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size. The top 88 px are
// the HUD strip; the rooms themselves live inside the outer wall below it.

export const FIELD = { width: 1280, height: 720, hudHeight: 88 };
export const BOUNDS = { x: 16, y: 96, width: 1248, height: 608 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const THIEF = {
  radius: 13,
  walkSpeed: 178,
  sneakSpeed: 102,
  catchRadius: 30,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 74,
  chaseSpeed: 208,
  visionRange: 235,
  visionHalfAngle: 0.56, // ~32 degrees each side
  suspicionRise: 1.35, // per second while the thief is in the cone
  suspicionRiseClose: 2.4, // per second when the thief is very close
  suspicionFall: 0.4,
  loseSightSeconds: 2.5,
};

export const CAMERA = {
  range: 275,
  halfAngle: 0.49, // ~28 degrees each side
  sweepSpeed: 0.55, // radians per second of the sweep oscillator
  alarmPerSecond: 12,
};

export const LASER = {
  alarmOnTrip: 12,
  tripCooldown: 1.0,
};

export const ALARM = {
  decayPerSecond: 3,
  spotBurst: 25, // added the moment a guard fully spots the thief
  crackPerSecond: 6, // added while the thief is cracking a case
  max: 100,
};

export const CRACK_SECONDS = 1.4; // hold E on the loot case
export const HACK_SECONDS = 2.0; // hold E on a camera junction box
export const COIN_COUNT = 3;
export const COIN_LURE_RADIUS = 290;
export const COIN_INVESTIGATE_SECONDS = 4;

export const PALETTE = {
  backdrop: '#0b0d12',
  floor: '#1c1a24',
  floorTile: '#232030',
  carpet: '#5a1f2b',
  carpetEdge: '#8a6d2f',
  wall: '#2e3442',
  wallTrim: '#c9a227',
  caseGlass: 'rgba(150, 200, 235, 0.16)',
  caseFrame: '#c9a227',
  lootGlow: '#ffd94d',
  guard: '#3d5a80',
  guardChase: '#b03030',
  coneGuard: 'rgba(242, 180, 60, 0.20)',
  coneGuardEdge: 'rgba(242, 180, 60, 0.55)',
  coneCamera: 'rgba(229, 83, 75, 0.18)',
  coneCameraEdge: 'rgba(229, 83, 75, 0.5)',
  laser: '#ff3b30',
  laserOff: 'rgba(255, 59, 48, 0.25)',
  thief: '#14141f',
  thiefTrim: '#ffd94d',
  exit: '#2fae5f',
  exitGlow: 'rgba(47, 174, 95, 0.35)',
  panel: 'rgba(16, 18, 26, 0.92)',
  panelEdge: '#c9a227',
  text: '#f2ead8',
  muted: '#9a94a8',
  alarm: '#ff3b30',
  alarmTrack: '#3a2024',
  gold: '#ffd94d',
  silver: '#cfd6dd',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best total take is kept between visits (this browser only). */
export const BEST_KEY = 'meridian-heist.best-take';
