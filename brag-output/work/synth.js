// 120 BPM, D major. Music + SFX written as one piece, rendered to audio.wav
const fs = require('fs');
const TL = JSON.parse(fs.readFileSync('timeline.json'));
const SR = 44100, DUR = TL.duration, N = SR * DUR;
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const add = (t0, buf, g = 1, pan = 0, send = 0) => { const s0 = Math.round(t0 * SR);
  const gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < buf.length; i++) { const j = s0 + i; if (j < 0 || j >= N) continue; L[j] += buf[i] * gl; R[j] += buf[i] * gr; SEND[j] += buf[i] * g * send; } };
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

// instruments
function pluck(f, dur = 0.9) { const n = Math.round(dur * SR), p = Math.max(2, Math.round(SR / f)), d = new Float32Array(p), o = new Float32Array(n);
  for (let i = 0; i < p; i++) d[i] = rnd() * 0.5; let lp = 0;
  for (let i = 0; i < n; i++) { const k = i % p, nx = (i + 1) % p; const v = 0.5 * (d[k] + d[nx]) * 0.994; lp += 0.5 * (v - lp); d[k] = v; o[i] = lp * Math.min(1, (n - i) / (0.05 * SR)); } return o; }
function pad(notes, dur) { const n = Math.round(dur * SR), o = new Float32Array(n); let lp = 0;
  for (let i = 0; i < n; i++) { const t = i / SR; let s = 0;
    for (const m of notes) for (const det of [-0.12, 0.12]) { const f = mtof(m + det / 1); for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * f * h * t + h) / (h * h); }
    lp += 0.08 * (s - lp); const env = Math.min(1, t / 0.35) * Math.min(1, (dur - t) / 0.35); o[i] = lp * env / notes.length; } return o; }
function bass(m, dur) { const n = Math.round(dur * SR), o = new Float32Array(n), f = mtof(m);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * Math.min(1, t / 0.02) * Math.exp(-t * 1.2) * Math.min(1, (dur - t) / 0.05); } return o; }
function kick() { const n = Math.round(0.35 * SR), o = new Float32Array(n); let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 45 + 75 * Math.exp(-t * 30); ph += 2 * Math.PI * f / SR; o[i] = Math.sin(ph) * Math.exp(-t * 11) * Math.min(1, t / 0.002); } return o; }
function shaker(dec = 40, len = 0.08) { const n = Math.round(len * SR), o = new Float32Array(n); let prev = 0;
  for (let i = 0; i < n; i++) { const w = rnd(), hp = w - prev; prev = w; o[i] = hp * Math.exp(-i / SR * dec) * Math.min(1, i / (0.004 * SR)); } return o; }
function marimba(f, dec = 9) { const n = Math.round(0.6 * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 3.98 * t) * Math.exp(-t * 30)) * Math.exp(-t * dec) * Math.min(1, t / 0.0015); } return o; }
function bell(f, dur = 2.2) { const n = Math.round(dur * SR), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.6) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 4) + 0.12 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 8)) * Math.min(1, t / 0.002); } return o; }
function swell(dur, rising = true) { const n = Math.round(dur * SR), o = new Float32Array(n); let lp = 0;
  for (let i = 0; i < n; i++) { const k = i / n, env = rising ? k * k : Math.sin(Math.PI * k); const c = 0.02 + 0.25 * env; lp += c * (rnd() - lp); o[i] = lp * env; } return o; }

// arrangement: one chord per bar (2s)
const CH = { D: [50, 54, 57, 38], A: [49, 52, 57, 33], Bm: [50, 54, 59, 35], G: [50, 55, 59, 31] };
const prog = ['D', 'A', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'D', 'D'];
prog.forEach((c, bar) => { const t0 = bar * 2, [a, b, cc, bs] = CH[c], last = bar >= 9;
  add(t0 - 0.05, pad([a, b, cc], bar === 10 ? 2.05 : 2.4), last ? 0.16 : 0.11, 0, 0.3);
  if (bar === 9) { add(t0, pad([a + 12, b + 12, cc], 4), 0.05, 0, 0.4); }
  if (bar < 10) add(t0, bass(bs + 12, last ? 3.5 : 1.9), last ? 0.22 : 0.26);
  const arp = [a, b, cc, a + 12, cc, b, cc, a + 12];
  for (let e = 0; e < 8; e++) { const t = t0 + e * 0.25; if (t > 21.2) break;
    const g = (bar === 0 ? 0.05 + 0.03 * e / 8 : 0.09) * (e % 2 ? 0.75 : 1) * (last ? 0.7 : 1);
    add(t, pluck(mtof(arp[e] + 12), 0.8), g, e % 2 ? 0.35 : -0.35, 0.35); }
  if (bar >= 1 && bar <= 8) for (let q = 0; q < 4; q++) { const t = t0 + q * 0.5;
    if (q % 2 === 0) add(t, kick(), 0.34);
    add(t + 0.25, shaker(), 0.035, 0.4, 0.1); if (bar >= 4) add(t, shaker(70, 0.05), 0.018, -0.4); }
});
add(17.3, swell(0.7), 0.35, 0, 0.5);  // lift into the outro
add(18.0, kick(), 0.3);

// sfx, in key and on the grid
const ladder = [69, 71, 74, 76, 78, 81, 83, 86];     // A4 up the D pentatonic
let li = 0;
for (const t of TL.clicks) {
  if (t === TL.send) continue;
  if (t === TL.clicks[0]) { add(t, marimba(mtof(74), 7), 0.16, 0, 0.35); continue; }
  if (t >= 13) { add(t, marimba(mtof(t * 4 % 2 ? 71 : 74), 14), 0.05, 0.2, 0.2); continue; } // + clicks, background
  add(t, marimba(mtof(ladder[li++ % ladder.length]), 9), 0.13, -0.1, 0.35);
}
for (const t of TL.typing) add(t, shaker(160, 0.03), 0.05, -0.2, 0.1);
for (const t of TL.whoosh) add(t - 0.05, swell(0.55, false), 0.1, 0, 0.3);
[74, 78, 81, 86].forEach((m, i) => add(TL.send + i * 0.045, bell(mtof(m)), 0.08, (i - 1.5) * 0.25, 0.5));
[62, 66, 69, 74].forEach((m, i) => add(18.45 + i * 0.12, bell(mtof(m + 12), 2.5), 0.045, (i - 1.5) * 0.3, 0.6));

// shared room: Schroeder reverb on the send bus
function reverb(x, combs, g = 0.8) { const y = new Float32Array(N);
  for (const d of combs) { const b = new Float32Array(d); let k = 0, lp = 0; for (let i = 0; i < N; i++) { const o = b[k]; lp = o * 0.7 + lp * 0.3; b[k] = x[i] + lp * g; y[i] += o / combs.length; k = (k + 1) % d; } }
  for (const [d, a] of [[225, 0.5], [556, 0.5]]) { const b = new Float32Array(d); let k = 0; for (let i = 0; i < N; i++) { const bo = b[k], v = y[i] + bo * a; y[i] = bo - v * a; b[k] = v; k = (k + 1) % d; } }
  return y; }
const rl = reverb(SEND, [1557, 1617, 1491, 1422]), rr = reverb(SEND, [1277, 1356, 1188, 1116]);
let peak = 0; for (let i = 0; i < N; i++) { L[i] += rl[i] * 0.35; R[i] += rr[i] * 0.35; peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const gain = 0.85 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { const fade = Math.min(1, (N - i) / (1.2 * SR), i / (0.01 * SR));
  const s = v => Math.round(Math.tanh(v * gain * fade * 1.1) * 32767);
  buf.writeInt16LE(s(L[i]), 44 + i * 4); buf.writeInt16LE(s(R[i]), 46 + i * 4); }
fs.writeFileSync('audio.wav', buf); console.log('peak', peak.toFixed(3));
