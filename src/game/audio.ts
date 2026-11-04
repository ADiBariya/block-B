type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
type SoundEffect =
  | 'start' | 'place' | 'clear' | 'combo' | 'amazing' | 'incredible' | 'legendary'
  | 'invalid' | 'over' | 'rotate' | 'click' | 'select' | 'refill' | 'record';

class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    try {
      const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Context) return;
      if (!this.context) {
        this.context = new Context();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;
        this.master = this.context.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Audio is optional when the browser blocks it. */ }
  }

  private note(
    frequency: number,
    delay: number,
    length: number,
    volume = 0.055,
    type: OscillatorType = 'sine',
    endFrequency?: number,
  ) {
    if (!this.enabled || !this.context || !this.master) return;
    const time = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + length * 0.7);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + length + 0.02);
  }

  private noise(
    delay: number,
    length: number,
    volume: number,
    filter: BiquadFilterType = 'highpass',
    frequency = 2200,
  ) {
    if (!this.enabled || !this.context || !this.master) return;
    const time = this.context.currentTime + delay;
    const sampleCount = Math.max(1, Math.ceil(this.context.sampleRate * length));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index++) {
      samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / sampleCount, 2);
    }
    const source = this.context.createBufferSource();
    const filterNode = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filterNode.type = filter;
    filterNode.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + length);
    source.connect(filterNode);
    filterNode.connect(gain);
    gain.connect(this.master);
    source.start(time);
    source.stop(time + length + 0.02);
  }

  private flourish(notes: number[], spacing = 0.06, volume = 0.045, length = 0.24, bass = false) {
    notes.forEach((frequency, index) => {
      this.note(frequency, index * spacing, length, volume, index % 2 ? 'triangle' : 'sine');
      if (bass) this.note(frequency / 2, index * spacing, length * 0.8, volume * 0.3, 'sine');
    });
  }

  play(kind: SoundEffect) {
    this.unlock();
    if (!this.enabled) return;
    if (kind === 'select') {
      this.note(720, 0, 0.045, 0.025, 'sine', 880);
    } else if (kind === 'place') {
      this.noise(0, 0.07, 0.022, 'lowpass', 620);
      this.note(196, 0, 0.075, 0.055, 'triangle', 146);
      this.note(588, 0.022, 0.055, 0.018);
    } else if (kind === 'clear') {
      this.flourish([523.25, 659.25, 783.99, 1046.5], 0.062, 0.045, 0.25);
      this.noise(0, 0.13, 0.014, 'highpass', 5200);
    } else if (kind === 'combo') {
      this.flourish([523.25, 659.25, 783.99, 1046.5, 1318.51], 0.057, 0.048, 0.28, true);
      this.noise(0.04, 0.18, 0.017, 'highpass', 5600);
    } else if (kind === 'amazing') {
      this.flourish([659.25, 783.99, 987.77, 1174.66, 1567.98], 0.052, 0.05, 0.3, true);
      [1046.5, 1318.51, 1567.98].forEach((frequency, index) => this.note(frequency, 0.29 + index * 0.065, 0.32, 0.035, 'triangle'));
      this.noise(0.03, 0.22, 0.02, 'highpass', 6000);
    } else if (kind === 'incredible') {
      this.flourish([783.99, 987.77, 1174.66, 1567.98, 1975.53], 0.047, 0.055, 0.33, true);
      this.note(261.63, 0, 0.4, 0.045, 'triangle');
      [1318.51, 1567.98, 2093].forEach((frequency, index) => this.note(frequency, 0.26 + index * 0.055, 0.38, 0.03, 'sine'));
      this.noise(0.02, 0.3, 0.024, 'highpass', 6300);
    } else if (kind === 'legendary') {
      [130.81, 196, 261.63].forEach((frequency) => this.note(frequency, 0, 0.55, 0.038, 'triangle'));
      this.flourish([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093], 0.045, 0.055, 0.35, true);
      [1046.5, 1318.51, 1567.98, 2093].forEach((frequency, index) => this.note(frequency, 0.36 + index * 0.06, 0.48, 0.035, 'sine'));
      this.noise(0.01, 0.38, 0.026, 'highpass', 6500);
      this.noise(0.28, 0.24, 0.018, 'highpass', 7800);
    } else if (kind === 'refill') {
      [783.99, 987.77, 1318.51].forEach((frequency, index) => this.note(frequency, index * 0.055, 0.16, 0.03, 'sine'));
      this.noise(0.04, 0.14, 0.012, 'highpass', 6800);
    } else if (kind === 'invalid') {
      this.note(146.83, 0, 0.1, 0.035, 'triangle', 130.81);
      this.noise(0, 0.07, 0.015, 'lowpass', 420);
    } else if (kind === 'over') {
      this.flourish([523.25, 440, 392, 329.63], 0.12, 0.035, 0.35);
      this.note(261.63, 0.48, 0.45, 0.03, 'sine');
    } else if (kind === 'rotate') {
      this.note(440, 0, 0.11, 0.032, 'sine', 740);
      this.note(880, 0.055, 0.08, 0.018, 'triangle');
    } else if (kind === 'start') {
      this.flourish([392, 523.25, 659.25, 783.99], 0.075, 0.04, 0.3);
      this.noise(0.11, 0.18, 0.012, 'highpass', 4800);
    } else if (kind === 'record') {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((frequency, index) => this.note(frequency, index * 0.085, 0.4, 0.055, 'triangle'));
      [523.25, 659.25, 783.99].forEach((frequency) => this.note(frequency, 0.4, 0.65, 0.025, 'sine'));
      this.noise(0.08, 0.32, 0.018, 'highpass', 6000);
    } else {
      this.note(660, 0, 0.06, 0.023, 'sine', 740);
    }
  }
}

export const gameAudio = new GameAudio();
