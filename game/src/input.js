// Keyboard and pointer input. Held keys give a steering vector; one-shot
// presses (confirm, pause, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// A mouse click is translated into a world-space coin-throw target.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT = new Set(['KeyE']);
const MUTE = new Set(['KeyM']);

/**
 * `toWorld` converts a pointer event's client coordinates into playfield
 * coordinates; the renderer supplies it (it knows the current scale).
 */
export function createInput(canvas, toWorld) {
  const held = new Set();
  let actions = 0;
  let throwAt = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || SNEAK.has(event.code) || INTERACT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      event.preventDefault();
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    const point = toWorld(event.clientX, event.clientY);
    if (point) throwAt = point;
    actions |= ACTION_CONFIRM;
  });

  function axis(negative, positive) {
    let value = 0;
    for (const code of negative) if (held.has(code)) value -= 1;
    for (const code of positive) if (held.has(code)) value += 1;
    return Math.max(-1, Math.min(1, value));
  }

  return {
    /** Normalised steering vector {x, y} from the held movement keys. */
    steer() {
      const x = axis(LEFT, RIGHT);
      const y = axis(UP, DOWN);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    sneak() {
      for (const code of SNEAK) if (held.has(code)) return true;
      return false;
    },
    interact() {
      for (const code of INTERACT) if (held.has(code)) return true;
      return false;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click's world point, if any, since the last call. */
    takeThrow() {
      const taken = throwAt;
      throwAt = null;
      return taken;
    },
  };
}
