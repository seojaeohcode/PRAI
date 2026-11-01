// Music analysis for the beat grid: tempo, first beat, downbeat (bar phase), beat clarity and energy per bar.
// Pure TypeScript on mono PCM — no native deps. Method: spectral-flux onset curve → autocorrelation for a coarse
// tempo → fine comb search over tempo × phase (so a 60–90 s track lands within ~0.01 BPM) → low-band accents for bar 1.

export type BeatAnalysis = {
  bpm: number;
  offset: number;            // seconds of the first beat (0 ≤ offset < one beat)
  downbeat: number;          // which of the first four beats is beat 1 of a bar (0–3)
  clarity: number;           // mean onset strength on the grid ÷ mean overall (≈1 = no beat, >2 = clear)
  barConfidence: number;     // how much the chosen downbeat stands out (1 = not at all)
  energy: number[];          // loudness per bar from the first downbeat, 0–1 (1 = loudest bar)
  duration: number;          // seconds analysed
};

function fftMag(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

// onset curves: full-band and low-band (< ~180 Hz, where the kick is) spectral flux, one value per hop
function onsets(x: Float32Array, sr: number, n = 1024, hop = 256) {
  const frames = Math.max(0, Math.floor((x.length - n) / hop));
  const win = new Float64Array(n).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  const half = n / 2, lowBins = Math.max(2, Math.round((180 / sr) * n));
  let prev = new Float64Array(half);
  const full = new Float64Array(frames), low = new Float64Array(frames), rms = new Float64Array(frames);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < n; i++) { const v = x[f * hop + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    rms[f] = Math.sqrt(e / n);
    fftMag(re, im);
    const cur = new Float64Array(half);
    let s = 0, sl = 0;
    for (let k = 1; k < half; k++) {
      cur[k] = Math.log1p(10 * Math.hypot(re[k], im[k]));
      const d = cur[k] - prev[k];
      if (d > 0) { s += d; if (k < lowBins) sl += d; }
    }
    full[f] = s; low[f] = sl; prev = cur;
  }
  return { full: normalize(smooth(full)), low: normalize(smooth(low)), rms, fps: sr / hop };
}
const smooth = (a: Float64Array) => a.map((_, i) => (a[i - 1] ?? a[i]) * 0.25 + a[i] * 0.5 + (a[i + 1] ?? a[i]) * 0.25);
function normalize(a: Float64Array) {
  const m = a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length)) || 1;
  return a.map((v) => Math.max(0, (v - m) / sd));
}
// value of a curve at a fractional index (linear)
const at = (a: Float64Array, i: number) => { const k = Math.floor(i), t = i - k; return k + 1 < a.length ? a[k] * (1 - t) + a[k + 1] * t : 0; };

export function analyzeBeats(x: Float32Array, sr: number, opts: { minBpm?: number; maxBpm?: number; beatsPerBar?: number } = {}): BeatAnalysis {
  const { minBpm = 70, maxBpm = 180, beatsPerBar = 4 } = opts;
  const { full, low, rms, fps } = onsets(x, sr);
  if (full.length < fps * 8) throw new Error("track too short to analyse (need 8 s or more)");
  // 1) coarse tempo: autocorrelation peak inside the range, preferring the 90–150 BPM octave
  const lagMin = Math.floor((fps * 60) / maxBpm), lagMax = Math.ceil((fps * 60) / minBpm);
  let best = { lag: lagMin, score: -Infinity };
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    for (let i = 0; i + lag < full.length; i++) s += full[i] * full[i + lag];
    const bpm = (fps * 60) / lag, pref = bpm >= 90 && bpm <= 150 ? 1 : 0.85;
    if (s * pref > best.score) best = { lag, score: s * pref };
  }
  const coarse = (fps * 60) / best.lag;
  // 2) fine comb search: tempo ± 3 BPM in 0.01 steps × phase in quarter hops; score = mean onset on the grid
  const comb = (bpm: number, phase: number) => {
    const period = (fps * 60) / bpm; let s = 0, n = 0;
    for (let i = phase; i < full.length - 1; i += period) { s += at(full, i); n++; }
    return n ? s / n : 0;
  };
  let fine = { bpm: coarse, phase: 0, score: -Infinity };
  for (let bpm = coarse - 3; bpm <= coarse + 3; bpm += 0.05) {
    const period = (fps * 60) / bpm;
    for (let p = 0; p < period; p += 0.5) { const s = comb(bpm, p); if (s > fine.score) fine = { bpm, phase: p, score: s }; }
  }
  for (let bpm = fine.bpm - 0.06; bpm <= fine.bpm + 0.06; bpm += 0.005) {
    const period = (fps * 60) / bpm;
    for (let p = Math.max(0, fine.phase - 2); p < Math.min(period, fine.phase + 2); p += 0.125) { const s = comb(bpm, p); if (s > fine.score) fine = { bpm, phase: p, score: s }; }
  }
  const period = (fps * 60) / fine.bpm;
  const mean = full.reduce((s, v) => s + v, 0) / full.length || 1;
  // 3) bar phase: the beat (mod beatsPerBar) with the strongest low-band accent is beat 1
  const acc = new Array(beatsPerBar).fill(0), cnt = new Array(beatsPerBar).fill(0);
  for (let k = 0, i = fine.phase; i < low.length - 1; k++, i += period) { acc[k % beatsPerBar] += at(low, i) + 0.5 * at(full, i); cnt[k % beatsPerBar]++; }
  const avg = acc.map((a, i) => a / Math.max(1, cnt[i]));
  const downbeat = avg.indexOf(Math.max(...avg));
  const others = avg.filter((_, i) => i !== downbeat), rest = others.reduce((s, v) => s + v, 0) / Math.max(1, others.length);
  // 4) loudness per bar from the first downbeat, scaled 0–1
  const barLen = period * beatsPerBar, start = fine.phase + downbeat * period, energy: number[] = [];
  for (let b = start; b + barLen <= rms.length; b += barLen) {
    let e = 0; for (let i = Math.floor(b); i < Math.floor(b + barLen); i++) e += rms[i] * rms[i];
    energy.push(Math.sqrt(e / barLen));
  }
  const emax = Math.max(1e-9, ...energy);
  // a frame's onset sits at the centre of its analysis window, half a window after the frame's start
  let first = fine.phase / fps + 512 / sr, db = downbeat;
  const beatSec = 60 / fine.bpm;
  if (first > beatSec - 0.02) { first = Math.max(0, first - beatSec); db = (db + 1) % beatsPerBar; }   // the grid gains the beat at ~0 s
  return {
    bpm: Math.round(fine.bpm * 100) / 100,
    offset: Math.round(first * 1000) / 1000,
    downbeat: db,
    clarity: Math.round((fine.score / mean) * 100) / 100,
    barConfidence: Math.round((avg[downbeat] / (rest || 1e-9)) * 100) / 100,
    energy: energy.map((e) => Math.round((e / emax) * 100) / 100),
    duration: Math.round((x.length / sr) * 100) / 100,
  };
}
