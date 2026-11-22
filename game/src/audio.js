// Synthesised sound: every cue is a WebAudio oscillator, so the game ships
// no audio files and makes no network request. The context is created lazily
// on the first user gesture (browsers block audio before one).

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') void ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      const start = ctx.currentTime + when;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch {
      // Sound is garnish: a failure here must never stop the game.
    }
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.16);
      tone(1318, 0.16, 'sine', 0.12, 0.07);
    },
    coinToss() {
      tone(660, 0.08, 'triangle', 0.12);
    },
    coinLand() {
      tone(1568, 0.1, 'sine', 0.1);
      tone(2093, 0.14, 'sine', 0.08, 0.08);
    },
    crackTick() {
      tone(320, 0.05, 'square', 0.05);
    },
    hackDone() {
      tone(523, 0.1, 'square', 0.1);
      tone(784, 0.14, 'square', 0.1, 0.09);
    },
    loot() {
      tone(523, 0.12, 'sine', 0.16);
      tone(659, 0.12, 'sine', 0.16, 0.09);
      tone(784, 0.2, 'sine', 0.16, 0.18);
      tone(1046, 0.3, 'sine', 0.14, 0.27);
    },
    spotted() {
      tone(196, 0.22, 'sawtooth', 0.16);
      tone(147, 0.3, 'sawtooth', 0.16, 0.12);
    },
    laserTrip() {
      tone(1200, 0.09, 'square', 0.12);
      tone(900, 0.12, 'square', 0.1, 0.07);
    },
    caught() {
      tone(220, 0.25, 'sawtooth', 0.18);
      tone(165, 0.35, 'sawtooth', 0.18, 0.2);
      tone(110, 0.5, 'sawtooth', 0.18, 0.45);
    },
    roomClear() {
      tone(659, 0.12, 'sine', 0.16);
      tone(784, 0.12, 'sine', 0.16, 0.1);
      tone(1046, 0.24, 'sine', 0.16, 0.2);
    },
  };
}
