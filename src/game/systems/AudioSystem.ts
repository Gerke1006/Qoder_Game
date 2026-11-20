/**
 * 音频系统：全部音效由 WebAudio 实时合成，零外部音频文件。
 *
 * 边界：
 * - 不依赖 Phaser（gameConfig 里 audio.noAudio = true），因此场景切换不会重建音频上下文；
 * - 全局单例，静音状态持久化到 localStorage，顶部静音按钮是唯一开关；
 * - 浏览器要求用户手势后才能出声，unlock() 由 main.ts 在首次 pointerdown/keydown 时调用。
 */

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

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private ambienceStarted = false;
  private birdTimer: number | null = null;

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
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    }
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 首次用户手势时调用：创建上下文、恢复播放、铺底林间环境声。 */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.startAmbience();
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.muted) {
      return;
    }
    const t = this.ctx.currentTime;
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

  private tone(t: number, type: OscillatorType, from: number, to: number, dur: number, peak: number): void {
    if (!this.ctx || !this.master) {
      return;
    }
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(t: number, dur: number, peak: number, filterFreq: number): void {
    if (!this.ctx || !this.master) {
      return;
    }
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
    src.start(t);
  }

  /** 林间风声铺底 + 偶发鸟鸣：只在 unlock 时启动一次，不随场景重建。 */
  private startAmbience(): void {
    if (!this.ctx || !this.master || this.ambienceStarted) {
      return;
    }
    this.ambienceStarted = true;
    const seconds = 3;
    const frames = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
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
    src.start();
    lfo.start();

    const chirp = (): void => {
      if (!this.ctx || this.muted) {
        return;
      }
      const t = this.ctx.currentTime;
      const base = 2100 + Math.random() * 900;
      this.tone(t, 'sine', base, base * 1.35, 0.07, 0.035);
      this.tone(t + 0.1, 'sine', base * 1.2, base * 0.9, 0.09, 0.03);
    };
    this.birdTimer = window.setInterval(() => {
      if (Math.random() < 0.55) {
        chirp();
      }
    }, 6500);
  }

  /** 仅供测试/调试：释放全局定时器与上下文。 */
  dispose(): void {
    if (this.birdTimer !== null) {
      window.clearInterval(this.birdTimer);
      this.birdTimer = null;
    }
    this.ambienceStarted = false;
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const audio = new AudioSystem();
