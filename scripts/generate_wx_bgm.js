import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.resolve(__dirname, "..", "minigame", "audio");
const sampleRate = 22050;

function midi(note) {
  return 440 * 2 ** ((note - 69) / 12);
}

function oscillator(type, phase) {
  const sine = Math.sin(phase);
  if (type === "triangle") return (2 / Math.PI) * Math.asin(sine);
  if (type === "square") return Math.tanh(sine * 5);
  if (type === "bell") return sine + 0.34 * Math.sin(phase * 2) + 0.16 * Math.sin(phase * 3);
  if (type === "pulse") return Math.tanh((sine + 0.3 * Math.sin(phase * 2)) * 3);
  return sine;
}

function addNote(track, secondsPerBeat, startBeat, durationBeats, note, volume, type = "sine") {
  if (note === null || note === undefined) return;
  const start = Math.floor(startBeat * secondsPerBeat * sampleRate);
  const length = Math.max(1, Math.floor(durationBeats * secondsPerBeat * sampleRate));
  const end = Math.min(track.length, start + length);
  const frequency = midi(note);
  const attack = Math.max(1, Math.floor(Math.min(0.018, length / sampleRate / 4) * sampleRate));
  const release = Math.max(1, Math.floor(Math.min(0.07, length / sampleRate / 3) * sampleRate));
  for (let index = start; index < end; index += 1) {
    const local = index - start;
    const attackGain = Math.min(1, local / attack);
    const releaseGain = Math.min(1, (end - index) / release);
    const envelope = attackGain * releaseGain;
    const phase = 2 * Math.PI * frequency * (local / sampleRate);
    track[index] += oscillator(type, phase) * envelope * volume;
  }
}

function addKick(track, secondsPerBeat, beat, volume) {
  const start = Math.floor(beat * secondsPerBeat * sampleRate);
  const length = Math.floor(0.22 * sampleRate);
  let phase = 0;
  for (let offset = 0; offset < length && start + offset < track.length; offset += 1) {
    const time = offset / sampleRate;
    const frequency = 95 * Math.exp(-time * 12) + 42;
    phase += 2 * Math.PI * frequency / sampleRate;
    track[start + offset] += Math.sin(phase) * Math.exp(-time * 16) * volume;
  }
}

function addNoise(track, secondsPerBeat, beat, duration, volume, seed, highPass = false) {
  const start = Math.floor(beat * secondsPerBeat * sampleRate);
  const length = Math.floor(duration * sampleRate);
  let state = seed >>> 0;
  let previous = 0;
  for (let offset = 0; offset < length && start + offset < track.length; offset += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const raw = (state / 4294967296) * 2 - 1;
    const noise = highPass ? raw - previous * 0.82 : raw;
    previous = raw;
    const time = offset / sampleRate;
    track[start + offset] += noise * Math.exp(-time * (highPass ? 30 : 13)) * volume;
  }
}

function addPad(track, secondsPerBeat, startBeat, notes, volume) {
  notes.forEach((note, index) => addNote(track, secondsPerBeat, startBeat, 3.9, note, volume * (index === 0 ? 1 : 0.78), "sine"));
}

function makeHomeTrack() {
  const bpm = 108;
  const bars = 8;
  const secondsPerBeat = 60 / bpm;
  const track = new Float32Array(Math.floor(bars * 4 * secondsPerBeat * sampleRate));
  const chords = [
    [48, 60, 64, 67],
    [45, 57, 60, 64],
    [41, 53, 57, 60],
    [43, 55, 59, 62],
  ];
  const melody = [
    72, 76, 79, 76, 74, 72, 69, 72,
    76, 79, 81, 79, 76, 74, 72, null,
    72, 74, 76, 72, 69, 67, 69, 72,
    74, 76, 79, 76, 74, 72, 67, null,
    79, 76, 72, 74, 76, 79, 81, 79,
    76, 74, 72, 69, 72, 74, 76, null,
    72, 76, 79, 84, 81, 79, 76, 74,
    72, 69, 67, 69, 72, 74, 72, null,
  ];

  for (let bar = 0; bar < bars; bar += 1) {
    const chord = chords[bar % chords.length];
    const startBeat = bar * 4;
    addPad(track, secondsPerBeat, startBeat, chord.slice(1), 0.055);
    for (let step = 0; step < 8; step += 1) {
      const beat = startBeat + step * 0.5;
      addNote(track, secondsPerBeat, beat, 0.44, chord[1 + (step % 3)] + 12, 0.075, "triangle");
      if (step % 2 === 0) addNote(track, secondsPerBeat, beat, 0.78, chord[0], 0.12, "sine");
      if (step % 2 === 1) addNoise(track, secondsPerBeat, beat, 0.055, 0.018, 1000 + bar * 17 + step, true);
    }
    addKick(track, secondsPerBeat, startBeat, 0.16);
    addKick(track, secondsPerBeat, startBeat + 2, 0.11);
  }
  melody.forEach((note, index) => addNote(track, secondsPerBeat, index * 0.5, 0.42, note, 0.16, "bell"));
  return { track, bpm, label: "home" };
}

function makeBattleTrack() {
  const bpm = 144;
  const bars = 8;
  const secondsPerBeat = 60 / bpm;
  const track = new Float32Array(Math.floor(bars * 4 * secondsPerBeat * sampleRate));
  const roots = [38, 34, 36, 33];
  const lead = [
    62, 65, 69, 65, 62, 65, 70, 69,
    58, 62, 65, 62, 60, 64, 67, 64,
    62, 65, 69, 74, 72, 69, 65, 62,
    58, 60, 62, 65, 64, 61, 57, null,
  ];

  for (let bar = 0; bar < bars; bar += 1) {
    const startBeat = bar * 4;
    const root = roots[bar % roots.length];
    addPad(track, secondsPerBeat, startBeat, [root + 12, root + 15, root + 19], 0.038);
    for (let step = 0; step < 8; step += 1) {
      const beat = startBeat + step * 0.5;
      addNote(track, secondsPerBeat, beat, 0.39, root + (step % 2 ? 12 : 0), 0.19, "pulse");
      addNoise(track, secondsPerBeat, beat, 0.045, step % 2 ? 0.026 : 0.04, 9000 + bar * 31 + step, true);
    }
    [0, 2, 2.5].forEach((offset) => addKick(track, secondsPerBeat, startBeat + offset, 0.28));
    [1, 3].forEach((offset) => addNoise(track, secondsPerBeat, startBeat + offset, 0.16, 0.12, 3000 + bar * 13 + offset));
  }
  for (let repeat = 0; repeat < 2; repeat += 1) {
    lead.forEach((note, index) => addNote(track, secondsPerBeat, repeat * 16 + index * 0.5, 0.38, note + 12, 0.13, "square"));
  }
  return { track, bpm, label: "battle" };
}

function normalizeAndFade(track) {
  const fadeSamples = Math.floor(0.012 * sampleRate);
  let peak = 0;
  for (const value of track) peak = Math.max(peak, Math.abs(value));
  const gain = peak > 0 ? 0.86 / peak : 1;
  for (let index = 0; index < track.length; index += 1) {
    let edge = 1;
    if (index < fadeSamples) edge = index / fadeSamples;
    if (index >= track.length - fadeSamples) edge = (track.length - index - 1) / fadeSamples;
    track[index] *= gain * Math.max(0, edge);
  }
}

function toWav(track) {
  normalizeAndFade(track);
  const dataSize = track.length * 2;
  const output = Buffer.alloc(44 + dataSize);
  output.write("RIFF", 0);
  output.writeUInt32LE(36 + dataSize, 4);
  output.write("WAVE", 8);
  output.write("fmt ", 12);
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(sampleRate, 24);
  output.writeUInt32LE(sampleRate * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  output.write("data", 36);
  output.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < track.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, track[index]));
    output.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return output;
}

function writeTrack(fileName, composition) {
  const wav = toWav(composition.track);
  const outputPath = path.join(audioDir, fileName);
  fs.writeFileSync(outputPath, wav);
  const seconds = composition.track.length / sampleRate;
  console.log(`[generated] ${fileName} | ${composition.bpm} BPM | ${seconds.toFixed(2)}s | ${wav.length} bytes`);
}

fs.mkdirSync(audioDir, { recursive: true });
writeTrack("bgm_home.wav", makeHomeTrack());
writeTrack("bgm_battle.wav", makeBattleTrack());
