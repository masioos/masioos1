// Alert sounds made with the Web Audio API: no audio file, nothing loaded from outside.
// Browsers play sound only after the person has clicked somewhere on the page once.

type Note = { freq: number; at: number; length: number };

function play(notes: Note[], wave: OscillatorType) {
  const Ctx = typeof window === "undefined" ? undefined : window.AudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = n.freq;
    const t = ctx.currentTime + n.at;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + n.length + 0.05);
  }
  setTimeout(() => void ctx.close(), 2000);
}

/** Staff: a new request or a shopper step (cancel, accept…). Two rising notes, played twice. */
export function requestSound() {
  play(
    [
      { freq: 880, at: 0, length: 0.3 },
      { freq: 1320, at: 0.18, length: 0.35 },
      { freq: 880, at: 0.6, length: 0.3 },
      { freq: 1320, at: 0.78, length: 0.35 },
    ],
    "sine",
  );
}

/** Staff: a shopper wrote a message. Three short falling «pop» notes. */
export function messageSound() {
  play(
    [
      { freq: 1175, at: 0, length: 0.12 },
      { freq: 988, at: 0.14, length: 0.12 },
      { freq: 784, at: 0.28, length: 0.2 },
    ],
    "triangle",
  );
}

/** Shopper: the shop answered (confirmed, message, rejected). A soft rising chord. */
export function shopperSound() {
  play(
    [
      { freq: 523, at: 0, length: 0.4 },
      { freq: 659, at: 0.12, length: 0.4 },
      { freq: 784, at: 0.24, length: 0.6 },
    ],
    "sine",
  );
}
