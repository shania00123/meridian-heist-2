// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, room clear, caught and perfect heist.
//
// ?seed=N fixes the camera and laser phases. ?shot=start|play|cover|end
// (with &seed=N and &room=N) stages that scene instead of running the
// loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_CLEAR, EVENT_COIN, EVENT_EMP, EVENT_HACK, EVENT_LASER, EVENT_LOOT, EVENT_PICKUP, EVENT_SMOKE, EVENT_SPOT, CAUGHT_LOCKDOWN, CAUGHT_VAN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PERFECT, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { ROOMS } from './levels.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// Debug hook for the screenshot driver and play-tests: live state, read-only.
Object.defineProperty(window, '__meridian', {
  get() {
    return {
      phase: world.state.phase,
      take: world.state.take,
      totalTake: world.state.totalTake,
      alarm: Math.round(world.state.alarm),
      carrying: world.state.thief.carrying,
      coins: world.state.coins,
      thief: { x: Math.round(world.state.thief.x), y: Math.round(world.state.thief.y) },
      cameras: world.state.cameras.map((c) => ({ x: c.x, y: c.y, hacked: c.hacked, angle: +c.angle.toFixed(2) })),
      guards: world.state.guards.map((g) => ({ x: Math.round(g.x), y: Math.round(g.y), mode: g.mode, suspicion: +g.suspicion.toFixed(2), facing: +g.facing.toFixed(2) })),
    };
  },
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best take then lasts this visit only.
  }
}

function runShot(name) {
  const roomParam = Number.parseInt(params.get('room') ?? '0', 10);
  const roomIndex = Number.isInteger(roomParam) && roomParam >= 0 && roomParam < ROOMS.length ? roomParam : 0;
  const scene = stageShot(name, world, roomIndex);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world.state.totalTake);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toWorld);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let crackSoundAt = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each event.
  function announce(message) {
    status.textContent = message;
  }

  function startHeist() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Crack the case, then reach the GETAWAY door.');
  }

  function nextRoom() {
    if (world.state.roomIndex + 1 >= ROOMS.length) {
      screen = SCREEN_PERFECT;
      announce(`Perfect heist. Total take $${world.state.totalTake}.`);
      return;
    }
    world.loadRoom(world.state.roomIndex + 1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Floor ${world.state.roomIndex + 1}. ${world.state.room.name}.`);
  }

  function retryRoom() {
    const banked = world.state.totalTake;
    world.loadRoom(world.state.roomIndex);
    world.state.totalTake = banked;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Trying the room again.');
  }

  function playEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_COIN) audio.coinToss();
    if (events & EVENT_HACK) audio.hackDone();
    if (events & EVENT_LOOT) audio.loot();
    if (events & EVENT_SPOT) audio.spotted();
    if (events & EVENT_LASER) audio.laserTrip();
    if (events & EVENT_SMOKE) audio.smoke();
    if (events & EVENT_EMP) audio.emp();
    if (events & EVENT_CLEAR) audio.roomClear();
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_CLEAR) {
      if (world.state.totalTake > best) {
        best = world.state.totalTake;
        saveBest(best);
      }
      screen = SCREEN_CLEAR;
      announce(`Room clear. Total take $${world.state.totalTake}.`);
    } else if (events & EVENT_CAUGHT) {
      screen = SCREEN_CAUGHT;
      announce(world.state.caughtReason === CAUGHT_LOCKDOWN
        ? 'Caught: the alarm hit 100% and the Meridian locked down.'
        : world.state.caughtReason === CAUGHT_VAN
          ? 'Caught: the getaway van left without you.'
          : `Caught by ${world.state.caughtBy || 'a guard'}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startHeist();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CLEAR) nextRoom();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_CAUGHT) retryRoom();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_PERFECT) startHeist();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { dx: 0, dy: 0, sneak: false, use: false, throwAt: null }, true);
      return;
    }
    const steer = input.steer();
    const throwAt = input.takeThrow();
    const smoke = input.takeSmoke();
    const emp = input.takeEmp();
    const events = world.step(STEP, {
      dx: steer.x,
      dy: steer.y,
      sneak: input.sneak(),
      use: input.interact(),
      throwAt,
      smoke,
      emp,
    }, false);
    if (world.state.crackProgress > 0 && world.state.elapsed - crackSoundAt > 0.35) {
      crackSoundAt = world.state.elapsed;
      audio.crackTick();
    }
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world.state.totalTake);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('The Meridian Heist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
