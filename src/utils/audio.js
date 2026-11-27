// src/utils/audio.js
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Gentle bell chime for Pomodoro transitions
export function playChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.15, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 1.3);
    });
  } catch (err) {
    console.warn('Audio chime failed:', err);
  }
}

// Positive ding for correct quiz answer
export function playCorrectSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.00, now + 0.12); 

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.45);
  } catch (err) {
    console.warn('Audio ding failed:', err);
  }
}

// Ambient Noise Generation
class AmbientPlayer {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.filterNode = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.currentMode = 'none';
  }

  start(mode = 'rain', volume = 0.2) {
    this.stop();
    this.ctx = getAudioContext();
    if (!this.ctx) return;

    this.currentMode = mode;
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    this.filterNode = filter;
    filter.type = mode === 'rain' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(mode === 'rain' ? 800 : 500, this.ctx.currentTime);

    this.source.connect(filter);
    filter.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);

    this.source.start();
    this.isPlaying = true;
  }

  setVolume(volume) {
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    }
  }

  stop() {
    const source = this.source;
    const filter = this.filterNode;
    const gainNode = this.gainNode;

    this.source = null;
    this.filterNode = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.currentMode = 'none';

    if (source) {
      try {
        source.stop();
      } catch (e) {}
      try { source.disconnect(); } catch (e) {}
    }
    if (filter) {
      try { filter.disconnect(); } catch (e) {}
    }
    if (gainNode) {
      try { gainNode.disconnect(); } catch (e) {}
    }
  }
}

export const ambientPlayer = new AmbientPlayer();
