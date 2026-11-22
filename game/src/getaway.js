// The getaway phase: the moment the main loot is cracked, the job turns.
//
// Cracking the case is not the end of the room — it is the loud part. The
// alarm jumps, every guard in the room turns and runs for the thief, and a
// van timer starts: the getaway van waits 20 seconds and then it leaves,
// with or without the thief. Reaching the GETAWAY door before the timer
// runs out banks the take; the door is the win.
//
// The rank is the room's verdict, shown on the clear screen: Perfect for a
// quiet escape with time to spare, Clean for a tidy one, Loud for an
// escape that set the whole building screaming.

export const GETAWAY_SECONDS = 20;
export const GETAWAY_ALARM_RISE = 15;
/** A guard alerted by the crack needs this long to orient before it runs:
 * the thief's head start is the race. */
export const GETAWAY_REACT_SECONDS = 1.5;

/** Fresh getaway state: quiet until the loot is cracked. */
export function createGetawayState() {
  return { active: false, timer: 0, rank: null };
}

/** The loot is cracked: the van timer starts and the hunt is on. */
export function startGetaway(getaway) {
  getaway.active = true;
  getaway.timer = GETAWAY_SECONDS;
}

/**
 * Count the van timer down by `dt` seconds. Returns true the moment the
 * van leaves — the thief is stranded inside the Meridian.
 */
export function updateGetaway(getaway, dt) {
  if (!getaway.active) return false;
  getaway.timer -= dt;
  if (getaway.timer <= 0) {
    getaway.timer = 0;
    return true;
  }
  return false;
}

/** The room's verdict from the alarm at escape and the seconds to spare.
 * A Perfect escape is quiet and unhurried; a Loud one is an escape at all,
 * which still counts. */
export function rankForGetaway(alarm, timeLeft) {
  if (alarm <= 25 && timeLeft > 8) return 'Perfect';
  if (alarm <= 60) return 'Clean';
  return 'Loud';
}
