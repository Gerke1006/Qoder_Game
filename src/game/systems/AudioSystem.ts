/**
 * 零素材 WebAudio：原创拨弦短循环 + 实时合成音效/林间环境声。
 * 不依赖 Phaser；只有 main.ts 的用户手势可以创建/首次恢复上下文。
 */

export type AudioMood = 'menu' | 'battle' | 'boss' | 'reward' | 'victory' | 'defeat';

export type SfxName =
  | 'shoot'
  | 'hit'
  | 'crit'
  | 'kill'
  | 'coin'
  | 'hurt'
  | 'wave'
  | 'reward'
  | 'win'
  | 'lose'
  | 'click'
  | 'skill'
  | 'pause';

const MUTE_STORAGE_KEY = 'qoder-defense-muted';
const MUSIC_LEVEL = 0.38;
const PAUSED_MUSIC_LEVEL = 0.1;
const SFX_COOLDOWNS: Partial<Record<SfxName, number>> = { shoot: 0.05, hit: 0.05, kill: 0.065, coin: 0.06 };

// 手写的四小节乐句，MIDI 音高；-1 是休止。不是已有曲目或外部音频。
const PHRASES: Record<AudioMood, { bpm: number; chords: number[][]; melody: number[] }> = {
  menu: {
    bpm: 88,
    chords: [[48, 52, 55], [53, 57, 60], [57, 60, 64], [55, 59, 62]],
    melody: [76, -1, 79, 74, 76, -1, 72, -1, 77, -1, 76, 72, 69, -1, 72, -1,
      76, 81, -1, 79, 76, -1, 72, 74, 74, -1, 71, 74, 79, -1, 74, -1],
  },
  battle: {
    bpm: 112,
    chords: [[50, 53, 57], [58, 62, 65], [53, 57, 60], [48, 52, 55]],
    melody: [74, 77, -1, 81, 77, 74, 72, -1, 77, 74, 70, 74, 77, -1, 81, 77,
      76, 77, 81, -1, 84, 81, 77, 76, 79, -1, 76, 72, 74, 76, 72, -1],
  },
  boss: {
    bpm: 126,
    chords: [[45, 48, 52], [53, 57, 60], [50, 53, 57], [52, 56, 59]],
    melody: [69, 76, 72, 76, 81, -1, 79, 76, 77, 72, 69, 72, 77, 81, 77, -1,
      74, 77, 81, 77, 74, 72, 69, -1, 71, 76, 80, 83, 80, 76, 71, -1],
  },
  reward: {
    bpm: 98,
    chords: [[53, 57, 60], [55, 59, 62], [52, 55, 59], [57, 60, 64]],
    melody: [81, -1, 84, 79, 81, -1, 77, -1, 79, 83, -1, 86, 83, -1, 79, -1,
      83, 79, 76, -1, 79, -1, 83, -1, 84, -1, 81, 76, 81, -1, 79, -1],
  },
  victory: {
    bpm: 108,
    chords: [[48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60]],
    melody: [79, 76, 79, 84, -1, 83, 79, -1, 86, -1, 83, 79, 74, -1, 79, 83,
      84, 81, -1, 88, 84, -1, 81, 79, 81, -1, 77, 81, 84, -1, 79, -1],
  },
  defeat: {
    bpm: 72,
    chords: [[45, 48, 52], [50, 53, 57], [53, 57, 60], [52, 56, 59]],
    melody: [76, -1, -1, 72, 71, -1, 69, -1, 74, -1, 72, -1, 69, -1, -1, -1,
      72, -1, 69, 65, 69, -1, -1, -1, 71, -1, 68, -1, 64, -1, -1, -1],
  },
};

/** 一次性写入立体声 PCM；余音绕回开头，循环接缝不截断音符。 */
function synthesizeMusic(ctx: AudioContext, mood: AudioMood): AudioBuffer {
  const { bpm, chords, melody } = PHRASES[mood];
  const sampleRate = Math.min(ctx.sampleRate, 24000);
  const frames = Math.round(sampleRate * 16 * 60 / bpm);
  const buffer = ctx.createBuffer(2, frames, sampleRate);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const beat = frames / sampleRate / 16;

  const pluck = (at: number, midi: number, beats: number, level: number, pan: number): void => {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const start = Math.round(at * beat * sampleRate);
    const duration = beats * beat;
    const length = Math.floor(duration * sampleRate);
    const l = Math.cos(pan * Math.PI / 2) * level;
    const r = Math.sin(pan * Math.PI / 2) * level;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const phase = 2 * Math.PI * frequency * t;
      // 柔和基音 + 快速衰减的弦泛音/木质敲击泛音，避免纯蜂鸣器音色。
      const wave = Math.sin(phase)
        + 0.3 * Math.sin(phase * 2) * Math.exp(-t * 9)
        + 0.12 * Math.sin(phase * 3) * Math.exp(-t * 15)
        + 0.06 * Math.sin(phase * 4.17) * Math.exp(-t * 28);
      const envelope = Math.min(1, t / 0.006) * Math.exp(-3 * t / duration)
        * Math.min(1, (duration - t) / 0.04);
      const index = (start + i) % frames;
      left[index] += wave * envelope * l;
      right[index] += wave * envelope * r;
    }
  };

  chords.forEach((chord, bar) => {
    chord.forEach((note, i) => {
      pluck(bar * 4 + i * 0.04, note, 3.8, 0.15, 0.2 + i * 0.3);
      pluck(bar * 4 + 2 + i * 0.2, note + 12, 1.6, 0.065, 0.75 - i * 0.25);
    });
    pluck(bar * 4, chord[0] - 12, 2.9, 0.28, 0.5);
    pluck(bar * 4 + 2.5, chord[0] - 12, 1.5, 0.16, 0.5);
  });
  melody.forEach((note, i) => {
    if (note >= 0) {
      pluck(i / 2, note, melody[(i + 1) % melody.length] === -1 ? 1.35 : 0.85, 0.55, 0.46);
    }
  });

  if (mood === 'battle' || mood === 'boss') {
    for (let step = 0; step < 32; step++) {
      const start = Math.round(step * 0.5 * beat * sampleRate);
      const downbeat = step % 2 === 0;
      for (let i = 0; i < sampleRate * 0.16; i++) {
        const t = i / sampleRate;
        const kick = Math.sin(2 * Math.PI * (48 * t + 2.4 * (1 - Math.exp(-25 * t)))) * Math.exp(-t * 32);
        const wood = (Math.sin(2 * Math.PI * 950 * t) + 0.4 * Math.sin(2 * Math.PI * 1430 * t)) * Math.exp(-t * 85);
        const shaker = (Math.random() * 2 - 1) * Math.exp(-t * 100);
        const sample = Math.min(1, t / 0.002) * (downbeat ? kick * 0.22 + wood * 0.065 : shaker * 0.035);
        const index = (start + i) % frames;
        left[index] += sample * 0.75;
        right[index] += sample * 0.7;
      }
    }
  }

  // 每个乐句统一保留峰值余量；音乐总线再衰减，为实时音效让位。
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const scale = 0.82 / Math.max(0.82, peak);
  for (let i = 0; i < frames; i++) {
    left[i] *= scale;
    right[i] *= scale;
  }
  return buffer;
}

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffers = new Map<AudioMood, AudioBuffer>();
  private mood: AudioMood = 'menu';
  private paused = false;
  private hidden = false;
  private muted = false;
  private disposed = false;
  private resumeOnVisible = false;
  private awaitingGesture = false;
  private resumePending: Promise<void> | null = null;
  private suspendPending: Promise<void> | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceLfo: OscillatorNode | null = null;
  private ambienceNodes: AudioNode[] = [];
  private birdTimer: number | null = null;
  private voices = new Map<AudioScheduledSourceNode, AudioNode[]>();
  private lastSfxTimes: Partial<Record<SfxName, number>> = {};

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      /* 隐私模式下忽略持久化失败 */
    }
    this.updateMasterGain();
    if (muted) this.stopVoices();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMood(mood: AudioMood): void {
    if (this.disposed || this.mood === mood) return;
    this.mood = mood;
    this.stopMusic();
    this.startMusic();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(paused ? PAUSED_MUSIC_LEVEL : MUSIC_LEVEL, this.ctx.currentTime, 0.05);
    }
  }

  /** 后台立即静音并挂起；仅恢复此前已获手势许可的上下文，拒绝后等下一次手势。 */
  setHidden(hidden: boolean): void {
    if (this.disposed || this.hidden === hidden) return;
    this.hidden = hidden;
    this.updateMasterGain();
    if (hidden) {
      this.stopVoices();
      this.clearBirdTimer();
      this.resumeOnVisible = !this.awaitingGesture && !!this.ctx
        && (this.ctx.state === 'running' || this.resumePending !== null);
      this.suspendContext();
    } else if (this.resumeOnVisible && !this.awaitingGesture) {
      this.resumeContext();
    }
  }

  /** 只能由用户手势调用；setMood/play/取消静音都不会隐式解锁。 */
  unlock(): void {
    if (this.disposed || this.hidden) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.paused ? PAUSED_MUSIC_LEVEL : MUSIC_LEVEL;
      this.musicGain.connect(this.master);
    }
    this.awaitingGesture = false;
    this.resumeOnVisible = true;
    this.resumeContext(true);
  }

  private resumeContext(fromGesture = false): void {
    const ctx = this.ctx;
    if (!ctx || this.disposed || this.hidden || this.awaitingGesture || ctx.state === 'closed') return;
    if (ctx.state === 'running') {
      this.startMusic();
      this.startAmbience();
      return;
    }
    // 手势可重试一个因自动播放策略仍未完成的 resume；可见性事件不会反复重试。
    if (this.resumePending && !fromGesture) return;
    const pending = ctx.resume().then(() => {
      if (this.ctx !== ctx || this.disposed) return;
      if (this.hidden) {
        this.suspendContext();
      } else if (ctx.state === 'running') {
        this.startMusic();
        this.startAmbience();
      }
    }).catch(() => {
      if (this.ctx === ctx && ctx.state !== 'running') this.awaitingGesture = true;
    }).finally(() => {
      if (this.resumePending === pending) this.resumePending = null;
    });
    this.resumePending = pending;
  }

  private suspendContext(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed' || this.suspendPending) return;
    const pending = ctx.suspend().catch(() => {
      /* 即使浏览器拒绝挂起，master 在后台仍为零。 */
    }).then(() => {
      if (this.suspendPending === pending) this.suspendPending = null;
      if (this.ctx === ctx && !this.hidden && this.resumeOnVisible && !this.awaitingGesture) {
        this.resumeContext();
      }
    });
    this.suspendPending = pending;
  }

  private updateMasterGain(): void {
    if (!this.master || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.muted || this.hidden) {
      // 挂起会冻结自动化时钟，静音直接更新固有值。
      this.master.gain.cancelScheduledValues(0);
      this.master.gain.value = 0;
    } else {
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(0.9, t, 0.02);
    }
  }

  private startMusic(): void {
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.hidden || this.disposed || this.musicSource) return;
    let buffer = this.musicBuffers.get(this.mood);
    if (!buffer) {
      buffer = synthesizeMusic(this.ctx, this.mood);
      this.musicBuffers.set(this.mood, buffer);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.onended = () => {
      source.disconnect();
      if (this.musicSource === source) this.musicSource = null;
    };
    this.musicSource = source;
    source.start();
  }

  private stopMusic(): void {
    const source = this.musicSource;
    if (!source) return;
    this.musicSource = null;
    source.onended = null;
    source.stop();
    source.disconnect();
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running' || this.muted || this.hidden || this.disposed) return;
    const t = this.ctx.currentTime;
    const cooldown = SFX_COOLDOWNS[name];
    if (cooldown !== undefined) {
      if (t - (this.lastSfxTimes[name] ?? -Infinity) < cooldown) return;
      this.lastSfxTimes[name] = t;
    }
    switch (name) {
      case 'shoot':
        this.tone(t, 'triangle', 640, 190, 0.09, 0.1);
        this.noise(t, 0.05, 0.05, 2600);
        break;
      case 'hit':
        this.tone(t, 'square', 210, 90, 0.08, 0.12);
        break;
      case 'crit':
        this.tone(t, 'sawtooth', 880, 1500, 0.07, 0.12);
        this.tone(t + 0.06, 'sawtooth', 1500, 320, 0.12, 0.12);
        this.noise(t, 0.1, 0.08, 4200);
        break;
      case 'kill':
        this.tone(t, 'sine', 320, 60, 0.18, 0.18);
        this.noise(t, 0.12, 0.1, 900);
        break;
      case 'coin':
        this.tone(t, 'sine', 1320, 1320, 0.06, 0.1);
        this.tone(t + 0.07, 'sine', 1760, 1760, 0.09, 0.1);
        break;
      case 'hurt':
        this.tone(t, 'sawtooth', 150, 55, 0.3, 0.22);
        this.noise(t, 0.2, 0.12, 500);
        break;
      case 'wave':
        this.tone(t, 'triangle', 220, 330, 0.35, 0.16);
        this.tone(t + 0.02, 'triangle', 440, 660, 0.35, 0.08);
        break;
      case 'reward':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(t + i * 0.08, 'sine', f, f, 0.12, 0.12));
        break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.13, 'triangle', f, f, 0.3, 0.16));
        this.noise(t + 0.6, 0.4, 0.05, 6000);
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => this.tone(t + i * 0.2, 'sawtooth', f, f * 0.94, 0.26, 0.12));
        break;
      case 'click':
        this.tone(t, 'sine', 880, 720, 0.045, 0.07);
        break;
      case 'skill':
        this.noise(t, 0.28, 0.12, 1800);
        this.tone(t, 'sawtooth', 400, 980, 0.24, 0.1);
        break;
      case 'pause':
        this.tone(t, 'sine', 440, 220, 0.12, 0.09);
        break;
    }
  }

  private trackVoice(source: AudioScheduledSourceNode, ...nodes: AudioNode[]): void {
    this.voices.set(source, nodes);
    source.onended = () => this.releaseVoice(source);
  }

  private releaseVoice(source: AudioScheduledSourceNode): void {
    source.onended = null;
    source.disconnect();
    this.voices.get(source)?.forEach((node) => node.disconnect());
    this.voices.delete(source);
  }

  private stopVoices(): void {
    for (const source of this.voices.keys()) {
      source.stop();
      this.releaseVoice(source);
    }
  }

  private tone(t: number, type: OscillatorType, from: number, to: number, dur: number, peak: number): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running' || this.muted || this.hidden) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    this.trackVoice(osc, gain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, peak: number, filterFreq: number): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running' || this.muted || this.hidden) return;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = peak;
    src.connect(filter).connect(gain).connect(this.master);
    this.trackVoice(src, filter, gain);
    src.start(t);
  }

  /** 环境层与音乐层独立；唯一计时器仅负责稀疏鸟鸣，不用于排音乐。 */
  private startAmbience(): void {
    if (!this.ctx || !this.master || this.ctx.state !== 'running' || this.hidden || this.disposed) return;
    if (!this.ambienceSource) {
      const frames = this.ctx.sampleRate * 3;
      const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < frames; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        data[i] = last * 3.2;
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.13;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain).connect(gain.gain);
      src.connect(filter).connect(gain).connect(this.master);
      this.ambienceSource = src;
      this.ambienceLfo = lfo;
      this.ambienceNodes = [filter, gain, lfoGain];
      src.start();
      lfo.start();
    }
    if (this.birdTimer === null) {
      this.birdTimer = window.setInterval(() => {
        if (!this.ctx || this.ctx.state !== 'running' || this.muted || this.hidden || Math.random() >= 0.55) return;
        const t = this.ctx.currentTime;
        const base = 2100 + Math.random() * 900;
        this.tone(t, 'sine', base, base * 1.35, 0.07, 0.035);
        this.tone(t + 0.1, 'sine', base * 1.2, base * 0.9, 0.09, 0.03);
      }, 6500);
    }
  }

  private clearBirdTimer(): void {
    if (this.birdTimer !== null) {
      window.clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
  }

  /** Game DESTROY 时终结单例；未完成的恢复请求不会重新启动任何节点。 */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearBirdTimer();
    this.stopMusic();
    this.stopVoices();
    this.ambienceSource?.stop();
    this.ambienceSource?.disconnect();
    this.ambienceLfo?.stop();
    this.ambienceLfo?.disconnect();
    this.ambienceNodes.forEach((node) => node.disconnect());
    this.ambienceSource = null;
    this.ambienceLfo = null;
    this.ambienceNodes = [];
    this.musicGain?.disconnect();
    this.master?.disconnect();
    this.musicBuffers.clear();
    this.lastSfxTimes = {};
    const ctx = this.ctx;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.resumePending = null;
    this.suspendPending = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => { /* 已释放所有节点。 */ });
  }
}

export const audio = new AudioSystem();
