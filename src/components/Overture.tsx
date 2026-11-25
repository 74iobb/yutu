import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Delaunay } from 'd3-delaunay';

/**
 * 开篇序列：泻水置平地的意象。
 *
 * 水束落下 → 涟漪铺开 → 水面凝成 Voronoi 板块（与四步一一对应）→ 名句浮现。
 * 约 4.7 秒，任意时刻可跳过；每次会话只自动播一次，可从「更多 → 重看开篇」重播。
 *
 * 只用形状与光，不承载数据；种子点全部写死，不引入随机，
 * 保证每次显影的板块几何完全一致。
 */

/**
 * 应用级记录：页面加载后第一次进入主流程时自动播一次。
 * 用模块变量而不是 sessionStorage —— 刷新会重置、重新开场；
 * 在 SPA 内从沙盘返回首页则不会重复打扰。
 */
let autoPlayed = false;
/** 名句逐字读完、小字与落款落定后再退潮（落水与铺开占前 3.3s） */
const PLAY_MS = 7800;
/** 退潮 + 系统显影的总时长 */
const LEAVE_MS = 1150;
/** 朗诵起点，略早于名句浮现 */
const NARRATE_AT = 4420;

/** 名句逐字出现：`start` 为这一行的起始秒数，字与字之间间隔 0.11s */
const VERSE_LINES = [
  { text: '泻水置平地', start: 4.5 },
  { text: '各自东西南北流', start: 5.55 },
] as const;

type Phase = 'idle' | 'playing' | 'leaving';

/** 圆形水面的圆心与半径；下缘贴住 viewBox 底边，避免被裁出直线 */
const DISC = { cx: 500, cy: 600, r: 300 } as const;

/** 四个板块中心：与四步流程一一对应 */
const PLATE_CENTERS: ReadonlyArray<readonly [number, number, string]> = [
  [350, 470, '处境'],
  [662, 462, '环境'],
  [368, 730, '方向'],
  [668, 722, '闭环'],
];

/** 外围锚点：把中心格推出圆形水面，避免边缘出现细碎三角形 */
const RING: ReadonlyArray<readonly [number, number]> = [
  [110, 380],
  [300, 270],
  [520, 220],
  [760, 250],
  [900, 360],
  [930, 620],
  [860, 860],
  [640, 930],
  [360, 930],
  [140, 860],
  [70, 640],
  [170, 520],
];

const POINTS: [number, number][] = [
  ...PLATE_CENTERS.map(([x, y]) => [x, y] as [number, number]),
  ...RING.map(([x, y]) => [x, y] as [number, number]),
];

/** 模块顶层算一次：确定性、纯函数，不参与渲染 */
const VORONOI = Delaunay.from(POINTS).voronoi([40, 260, 960, 940]);

function cellPath(index: number): string {
  const poly = VORONOI.cellPolygon(index);
  if (!poly) return '';
  return (
    poly
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

/** 离场时四个板块「各自东西南北流」的方向，与各自所在象限一致 */
const PLATES = PLATE_CENTERS.map(([cx, cy, label], i) => ({
  label,
  cx,
  cy,
  d: cellPath(i),
  dx: [-190, 190, -190, 190][i],
  dy: [-128, -128, 128, 128][i],
  fill: [
    'rgba(96, 196, 255, 0.17)',
    'rgba(245, 186, 96, 0.14)',
    'rgba(162, 150, 255, 0.15)',
    'rgba(110, 220, 190, 0.13)',
  ][i],
}));

/**
 * 确定性伪随机（固定公式，不调用 Math.random）：
 * 同一序号每次得到同一个值，保证每次开场的水粒分布完全一致。
 */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** 五彩水色：青、粉、金、紫、薄荷，按序号循环分配 */
const WATER_COLORS = ['#8ee9ff', '#ffa8e0', '#ffe08a', '#b6a8ff', '#8dffcf'];

/** 移动端少一些粒子，避免低端机掉帧 */
const SMALL_SCREEN =
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(max-width: 640px)').matches);

/** 低核数 / 低内存设备：再降一档，关闭最贵的模糊与持续滤镜 */
const LOW_POWER =
  typeof navigator !== 'undefined' &&
  ((navigator.hardwareConcurrency ?? 8) <= 4 ||
    ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <=
      4);

const REDUCED_EFFECTS = SMALL_SCREEN || LOW_POWER;

/** 下落粒子：每 4 颗里 1 条速度线，其余是水珠；错峰持续约 2s */
const FALL_PARTICLES = Array.from(
  { length: REDUCED_EFFECTS ? 64 : 108 },
  (_, i) => {
    const a = noise(i * 3 + 1);
    const b = noise(i * 3 + 2);
    const c = noise(i * 3 + 3);
    return {
      x: 500 + (a - 0.5) * 96,
      r: 0.55 + b * 2,
      lift: 470 + c * 340,
      drift: (a - 0.5) * 34,
      delay: Math.round(b * 1950),
      duration: Math.round(720 + c * 620),
      line: i % 4 === 0,
      color: WATER_COLORS[i % WATER_COLORS.length],
    };
  }
);

/** 落点溅水：从水面向两侧上方抛起的水星 */
const SPLASH_PARTICLES = Array.from(
  { length: REDUCED_EFFECTS ? 18 : 28 },
  (_, i) => {
    const a = noise(i * 5 + 100);
    const b = noise(i * 5 + 101);
    const dir = i % 2 === 0 ? -1 : 1;
    return {
      sx: dir * (20 + a * 112),
      sy: -(16 + b * 70),
      r: 0.6 + a * 1.4,
      delay: Math.round(1350 + b * 1100),
      duration: Math.round(720 + a * 400),
      color: WATER_COLORS[(i + 2) % WATER_COLORS.length],
    };
  }
);

function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return false;
    }
    // index.html 的首帧脚本会把 localStorage 的开关恢复成这个 class
    if (document.documentElement.classList.contains('y-motion-off')) return false;
    return true;
  } catch {
    return false;
  }
}

/** 读取 URL 上的布尔开关（普通查询串或 hash 查询串均可） */
function readFlag(name: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = `${window.location.search}${window.location.hash}`;
    return new RegExp(`(?:^|[?&#])${name}=1(?:&|$)`).test(raw);
  } catch {
    return false;
  }
}

/**
 * 演示开关：`?overture=1` 每次刷新都播；`?demo=1` 同时进入路演模式。
 * 例如 `/#/?demo=1`。
 */
function forcedByUrl(): boolean {
  return readFlag('overture') || readFlag('demo');
}

/* ----------------------------- 合成音景 ----------------------------- */
/**
 * 不用系统 TTS 朗读 —— 机械感太重。
 * 改为 Web Audio 合成的音景：落水低频、逐字磬音、退潮钟声。
 * 所有声音共用一个 AudioContext；被自动播放策略拦截时静默降级。
 */
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudio(): { ctx: AudioContext; master: GainNode } | null {
  try {
    if (audioCtx && masterGain) {
      /* 系统休眠 / 浏览器回收后 context 可能已关闭，重建一次 */
      if (audioCtx.state !== 'closed') return { ctx: audioCtx, master: masterGain };
      audioCtx = null;
      masterGain = null;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
    audioCtx = ctx;
    masterGain = master;
    return { ctx, master };
  } catch {
    return null;
  }
}

/** 在当前用户手势里解锁音频；返回是否已真正 running */
async function unlockAudio(): Promise<boolean> {
  const audio = getAudio();
  if (!audio) return false;
  try {
    await Promise.race([
      audio.ctx.resume(),
      new Promise((resolve) => window.setTimeout(resolve, 600)),
    ]);
    return audio.ctx.state === 'running';
  } catch {
    return false;
  }
}

/* ----------------------------- 系统语音 ----------------------------- */
/**
 * 浏览器中文语音合成：不依赖录音文件。
 * 使用自然女声；rate 0.9 / 0.86，pitch 1.0。
 */
function pickVoice() {
  try {
    const voices = window.speechSynthesis.getVoices();
    const zh = voices.filter((v) => /^zh/i.test(v.lang));
    const cn = zh.filter((v) => /CN|Hans/i.test(v.lang));
    const pool = cn.length ? cn : zh;
    const female = pool.find((v) =>
      /Xiaoxiao|Xiaoyi|Ting-?Ting|Huihui|Meijia|Sinji|Female|女/i.test(v.name)
    );
    const natural = pool.find((v) =>
      /Google|Natural|Neural|Online/i.test(v.name)
    );
    return female ?? natural ?? pool[0];
  } catch {
    return undefined;
  }
}

function speakVerse(): void {
  try {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = pickVoice();
    ['泻水置平地。', '各自东西南北流。'].forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      if (voice) u.voice = voice;
      u.rate = i === 0 ? 0.9 : 0.86;
      u.pitch = 1;
      u.volume = 1;
      synth.speak(u);
    });
  } catch {
    /* 静默 */
  }
}

function stopSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

/* ------------------------------ 真人录音 ------------------------------ */
/**
 * 用户提供的朗诵录音，原样直出。
 * 不降调、不做 EQ、不做滤波、不做音量归一化 —— 除了静音开关，不改变任何东西。
 */
/** 默认使用系统语音；改回 `true` 恢复录音播放 */
const USE_RECORDING = false;

const VOICE_URL =
  'https://agent.nuwax.com/api/f/s3/app-dev/20261125/32d36e5a83aa4526bf7dcad9e50b738a.m4a';

let voiceBufferPromise: Promise<AudioBuffer | null> | null = null;
let voiceSource: AudioBufferSourceNode | null = null;
let voiceGateRaf = 0;

function loadVoiceBuffer(): Promise<AudioBuffer | null> {
  if (!voiceBufferPromise) {
    voiceBufferPromise = (async () => {
      try {
        const audio = getAudio();
        if (!audio) return null;
        const res = await fetch(VOICE_URL, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const data = await res.arrayBuffer();
        return await audio.ctx.decodeAudioData(data);
      } catch {
        return null;
      }
    })().then((buffer) => {
      /* 失败不缓存，下次重播还能再试一次 */
      if (!buffer) voiceBufferPromise = null;
      return buffer;
    });
  }
  return voiceBufferPromise;
}

function stopVoice(): void {
  if (voiceGateRaf) {
    cancelAnimationFrame(voiceGateRaf);
    voiceGateRaf = 0;
  }
  if (!voiceSource) return;
  try {
    voiceSource.stop();
  } catch {
    /* 已经结束 */
  }
  voiceSource = null;
}

/**
 * 用录音得到更成熟的人声：0.94 倍速（略降调、略放慢）。
 * 只保留轻降噪（100Hz 高通 / 7.5kHz 低通 / 噪声门）与音量归一化，
 * 不做 EQ，避免二次改变音色。
 */
async function playVoiceShifted(): Promise<boolean> {
  if (!USE_RECORDING) return false;
  if (voiceSource) return true;
  try {
    const audio = getAudio();
    if (!audio) return false;
    const unlocked = await unlockAudio();
    if (!unlocked) return false;
    const buffer = await loadVoiceBuffer();
    if (!buffer) return false;

    const ctx = audio.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    /* 只降噪、不变声：100Hz 高通 + 7.5kHz 低通 + 噪声门 */
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 100;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7500;

    const gate = ctx.createGain();
    gate.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;

    /* 音量归一化：把录音峰值拉到 0.95，最多放大 3 倍、至少 1.2 倍 */
    const out = ctx.createGain();
    let peak = 0;
    for (let c = 0; c < buffer.numberOfChannels; c += 1) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < data.length; i += 1) {
        const v = Math.abs(data[i]);
        if (v > peak) peak = v;
      }
    }
    out.gain.value = Math.min(3, Math.max(1.2, 0.95 / (peak || 0.4)));

    src.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gate);
    gate.connect(out);
    out.connect(audio.master);
    gate.connect(analyser);

    /*
     * 自适应噪声门：
     * 实时跟踪底噪（只向下取更小值、再缓慢回升），阈值取底噪的 2.2 倍；
     * 说话时全开，停下 160ms 后直接压到 -80dB，句间基本听不见底噪。
     */
    const samples = new Uint8Array(analyser.fftSize);
    let lastLoud = 0;
    let noiseFloor = 1;
    const tick = () => {
      const now = performance.now();
      analyser.getByteTimeDomainData(samples);
      let p2 = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const v = Math.abs(samples[i] - 128) / 128;
        if (v > p2) p2 = v;
      }
      if (p2 < noiseFloor) noiseFloor = p2;
      else noiseFloor = Math.min(1, noiseFloor * 1.0004);
      const threshold = Math.max(0.015, noiseFloor * 2.2);
      if (p2 > threshold) lastLoud = now;
      const open = now - lastLoud < 160;
      gate.gain.setTargetAtTime(
        open ? 1 : 0.0001,
        ctx.currentTime,
        open ? 0.008 : 0.06
      );
      voiceGateRaf = requestAnimationFrame(tick);
    };
    voiceGateRaf = requestAnimationFrame(tick);

    voiceSource = src;
    src.onended = () => {
      if (voiceSource === src) voiceSource = null;
      if (voiceGateRaf) {
        cancelAnimationFrame(voiceGateRaf);
        voiceGateRaf = 0;
      }
    };
    src.start();
    return true;
  } catch {
    return false;
  }
}

/** 静音 / 恢复所有合成声 */
function setAudioMuted(muted: boolean): void {
  if (!audioCtx || !masterGain) return;
  try {
    masterGain.gain.setTargetAtTime(
      muted ? 0.0001 : 1,
      audioCtx.currentTime,
      0.06
    );
  } catch {
    /* ignore */
  }
}

/**
 * 单行诗句：逐字拆开，`--i` 控制字与字的错峰、`--start` 控制这一行的起点。
 * 单独成组件而不是用 Fragment —— 平台会给元素注入属性，
 * 而 Fragment 只接受 key / children。
 */
function VerseLine({ line }: { line: (typeof VERSE_LINES)[number] }) {
  return (
    <p className='y-ov-line'>
      {Array.from(line.text).map((ch, i) => (
        <span
          key={i}
          className='y-ov-char'
          style={
            {
              '--i': i,
              '--start': line.start,
            } as CSSProperties
          }
        >
          {ch}
        </span>
      ))}
    </p>
  );
}

export default function Overture() {
  const [seq, setSeq] = useState<{ id: number; phase: Phase }>(() => {
    let auto = false;
    if (motionAllowed()) {
      if (forcedByUrl()) {
        auto = true;
      } else if (!autoPlayed) {
        autoPlayed = true;
        auto = true;
      }
    }
    return { id: auto ? 1 : 0, phase: auto ? 'playing' : 'idle' };
  });

  /**
   * 声音默认开。关闭只影响本次开篇，不写本地存储 ——
   * 避免之前点过「声音关」后，下次开篇莫名其妙没有声音。
   */
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(soundOn);
  /** 路演模式：强制有声、并显示一枚小标签；由「更多 → 路演模式」或 `?demo=1` 触发 */
  const [demo, setDemo] = useState(() => readFlag('demo'));
  const demoRef = useRef(demo);
  /** 音频是否真正跑起来（浏览器可能拦截无手势播放） */
  const [audioReady, setAudioReady] = useState(false);
  const audioReadyRef = useRef(false);
  const markAudioReady = useCallback((ready: boolean) => {
    audioReadyRef.current = ready;
    setAudioReady(ready);
  }, []);
  /** 统一入口：默认系统语音，录音仅作可选备份 */
  const speakOnce = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking || synth.pending) return;
    speakVerse();
  }, []);
  const startVoice = useCallback(() => {
    if (USE_RECORDING) {
      void playVoiceShifted();
      return;
    }
    speakOnce();
  }, [speakOnce]);

  /** 给全局手势监听读取当前播放阶段，避免闭包里的旧值 */
  const seqRef = useRef(seq);
  useEffect(() => {
    seqRef.current = seq;
  }, [seq]);
  const toggleSound = useCallback(() => {
    const next = !soundRef.current;
    soundRef.current = next;
    setSoundOn(next);
    if (next) {
      void unlockAudio().then(markAudioReady);
      setAudioMuted(false);
      startVoice();
    } else {
      stopVoice();
      stopSpeech();
      setAudioMuted(true);
      /* 手动静音即退出「强制有声」，但路演标记保留 */
      demoRef.current = false;
    }
  }, [markAudioReady, startVoice]);

  const skip = useCallback(() => {
    stopVoice();
    stopSpeech();
    setAudioMuted(true);
    setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
  }, []);

  /** 点击提示：打开声音开关并在同一手势里解锁音频 */
  const enableSound = useCallback(() => {
    if (!soundRef.current) {
      toggleSound();
      void unlockAudio().then(markAudioReady);
      return;
    }
    void unlockAudio().then((ok) => {
      if (!ok) return;
      markAudioReady(true);
      setAudioMuted(false);
      startVoice();
    });
  }, [markAudioReady, startVoice, toggleSound]);

  useEffect(() => {
    if (seq.phase === 'idle') markAudioReady(false);
  }, [markAudioReady, seq.phase]);

  /**
   * 浏览器要求用户手势才能出声。应用里任何一次点击 / 按键都先解锁一次，
   * 这样即使自动播放被拦，用户随手一点，后续声音就出来了。
   */
  useEffect(() => {
    const onGesture = () => {
      if (audioReadyRef.current) return;
      void unlockAudio().then((ok) => {
        if (!ok) return;
        markAudioReady(true);
        setAudioMuted(false);
        if (seqRef.current.phase === 'playing') {
          startVoice();
        }
      });
    };
    window.addEventListener('pointerdown', onGesture, {
      capture: true,
      passive: true,
    });
    window.addEventListener('keydown', onGesture, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, [markAudioReady, startVoice]);

  /**
   * 开篇内的第一次点击：若声音还没解锁，先开声音、不跳过；
   * 已经能出声时，点击才是跳过。
   */
  const handleOverlayClick = useCallback(() => {
    if (!audioReadyRef.current && soundRef.current) {
      void unlockAudio().then((ok) => {
        if (ok) {
          markAudioReady(true);
          setAudioMuted(false);
          return;
        }
        skip();
      });
      return;
    }
    skip();
  }, [markAudioReady, skip]);

  /** 「更多 → 重看开篇」：手动重播绕过会话记录，但仍尊重减弱动效 */
  useEffect(() => {
    const onReplay = (e: Event) => {
      if (!motionAllowed()) return;
      const nextDemo = Boolean(
        (e as CustomEvent<{ demo?: boolean }>).detail?.demo
      );
      demoRef.current = nextDemo;
      setDemo(nextDemo);
      setSeq((s) => ({ id: s.id + 1, phase: 'playing' }));
    };
    window.addEventListener('yutu:overture', onReplay);
    return () => {
      window.removeEventListener('yutu:overture', onReplay);
      stopVoice();
      stopSpeech();
    };
  }, []);

  /** 播放中：写会话记录、锁住页面滚动，到点收场 */
  useEffect(() => {
    if (seq.phase !== 'playing') return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    if (soundRef.current || demoRef.current) {
      setAudioMuted(false);
      /* 提前拉录音，名句出现时才能立刻出声 */
      void loadVoiceBuffer();
      /* 无手势时多半会被挂起，这里先试一次；失败由全局手势与提示按钮兜底 */
      void unlockAudio().then((ok) => {
        if (ok) markAudioReady(true);
      });
    }
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'playing' ? { ...s, phase: 'leaving' } : s));
    }, PLAY_MS);
    /* 名句浮现时：用系统语音朗读 */
    const voiceTimer = window.setTimeout(() => {
      if (!soundRef.current && !demoRef.current) return;
      setAudioMuted(false);
      startVoice();
    }, NARRATE_AT);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(voiceTimer);
      body.style.overflow = prevOverflow;
    };
  }, [seq.id, seq.phase, markAudioReady, startVoice]);

  /**
   * 退潮：水向四周散开、背景褪去，系统从下面显形。
   * 给 #yutu2 加一次性显影动画；卸载时移除，避免影响之后的切步。
   */
  useEffect(() => {
    if (seq.phase !== 'leaving') return;
    const shell = document.getElementById('yutu2');
    shell?.classList.add('y-ov-reveal');
    const timer = window.setTimeout(() => {
      setSeq((s) => (s.phase === 'leaving' ? { ...s, phase: 'idle' } : s));
    }, LEAVE_MS);
    return () => {
      window.clearTimeout(timer);
      shell?.classList.remove('y-ov-reveal');
    };
  }, [seq.id, seq.phase]);

  /** 任意键跳过；Tab 留给键盘导航 */
  useEffect(() => {
    if (seq.phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Tab' ||
        e.key === 'Shift' ||
        e.key === 'Control' ||
        e.key === 'Alt' ||
        e.key === 'Meta'
      ) {
        return;
      }
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [seq.phase, skip]);

  if (seq.phase === 'idle') return null;

  return (
    <div
      key={seq.id}
      className={`y-overture${seq.phase === 'leaving' ? ' is-leaving' : ''}${
        LOW_POWER ? ' y-ov-lite' : ''
      }`}
      onClick={handleOverlayClick}
    >
      <span className='y-ov-halo' aria-hidden='true' />

      {/* 展陈取景框与标识：只做氛围，不承载信息 */}
      <span className='y-ov-corner y-ov-corner-tl' aria-hidden='true' />
      <span className='y-ov-corner y-ov-corner-tr' aria-hidden='true' />
      <span className='y-ov-corner y-ov-corner-bl' aria-hidden='true' />
      <span className='y-ov-corner y-ov-corner-br' aria-hidden='true' />
      <span className='y-ov-mark' aria-hidden='true'>
        域途 · 序
      </span>
      <span className='y-ov-mark y-ov-mark-r' aria-hidden='true'>
        YUTU / OVERTURE
      </span>
      <span className='y-ov-vignette' aria-hidden='true' />
      <span className='y-ov-progress' aria-hidden='true' />

      <div className='y-ov-scene'>
        <svg
          className='y-ov-art'
          viewBox='0 0 1000 900'
          preserveAspectRatio='xMidYMid meet'
          aria-hidden='true'
          focusable='false'
        >
          <defs>
            <linearGradient id='y-ov-stream' x1='0' y1='0' x2='0.18' y2='1'>
              <stop offset='0%' stopColor='#8ee9ff' stopOpacity='0' />
              <stop offset='14%' stopColor='#d8f7ff' stopOpacity='0.95' />
              <stop offset='44%' stopColor='#ffa8e0' stopOpacity='0.8' />
              <stop offset='72%' stopColor='#ffe08a' stopOpacity='0.78' />
              <stop offset='100%' stopColor='#b6a8ff' stopOpacity='0.42' />
            </linearGradient>
            <linearGradient id='y-ov-stream-2' x1='0' y1='0' x2='0.3' y2='1'>
              <stop offset='0%' stopColor='#8dffcf' stopOpacity='0' />
              <stop offset='20%' stopColor='#b9ffe9' stopOpacity='0.9' />
              <stop offset='58%' stopColor='#8ee9ff' stopOpacity='0.7' />
              <stop offset='100%' stopColor='#b6a8ff' stopOpacity='0.35' />
            </linearGradient>
            <linearGradient id='y-ov-stream-3' x1='0' y1='0' x2='0.6' y2='1'>
              <stop offset='0%' stopColor='#ffd166' stopOpacity='0' />
              <stop offset='22%' stopColor='#ffe9b0' stopOpacity='0.85' />
              <stop offset='60%' stopColor='#ffa8e0' stopOpacity='0.6' />
              <stop offset='100%' stopColor='#8ee9ff' stopOpacity='0.3' />
            </linearGradient>
            <radialGradient id='y-ov-pool' cx='50%' cy='50%' r='50%'>
              <stop offset='0%' stopColor='#7fe7ff' stopOpacity='0.3' />
              <stop offset='30%' stopColor='#b48cff' stopOpacity='0.18' />
              <stop offset='60%' stopColor='#ff8ad4' stopOpacity='0.13' />
              <stop offset='84%' stopColor='#ffd166' stopOpacity='0.08' />
              <stop offset='100%' stopColor='#6bffc8' stopOpacity='0' />
            </radialGradient>
            <linearGradient id='y-ov-iris' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#65e6ff' stopOpacity='0.4' />
              <stop offset='25%' stopColor='#c08bff' stopOpacity='0.34' />
              <stop offset='50%' stopColor='#ff8ad4' stopOpacity='0.3' />
              <stop offset='75%' stopColor='#ffd166' stopOpacity='0.26' />
              <stop offset='100%' stopColor='#6bffc8' stopOpacity='0.34' />
            </linearGradient>
            <linearGradient id='y-ov-iris-2' x1='1' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#ffe08a' stopOpacity='0.3' />
              <stop offset='30%' stopColor='#8dffcf' stopOpacity='0.26' />
              <stop offset='58%' stopColor='#8ee9ff' stopOpacity='0.3' />
              <stop offset='80%' stopColor='#c08bff' stopOpacity='0.26' />
              <stop offset='100%' stopColor='#ffa8e0' stopOpacity='0.28' />
            </linearGradient>
            <linearGradient id='y-ov-sheen' x1='0' y1='0' x2='1' y2='0'>
              <stop offset='0%' stopColor='#ffffff' stopOpacity='0' />
              <stop offset='50%' stopColor='#ffffff' stopOpacity='0.6' />
              <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
            </linearGradient>
            <radialGradient id='y-ov-mist' cx='50%' cy='50%' r='50%'>
              <stop offset='0%' stopColor='#ffffff' stopOpacity='0.55' />
              <stop offset='38%' stopColor='#9be8ff' stopOpacity='0.3' />
              <stop offset='70%' stopColor='#ffa8e0' stopOpacity='0.16' />
              <stop offset='100%' stopColor='#b6a8ff' stopOpacity='0' />
            </radialGradient>
            <radialGradient id='y-ov-flash' cx='50%' cy='50%' r='50%'>
              <stop offset='0%' stopColor='#ffffff' stopOpacity='0.95' />
              <stop offset='40%' stopColor='#c8f3ff' stopOpacity='0.4' />
              <stop offset='72%' stopColor='#ffa8e0' stopOpacity='0.18' />
              <stop offset='100%' stopColor='#b6a8ff' stopOpacity='0' />
            </radialGradient>
            <clipPath id='y-ov-disc'>
              <circle cx={DISC.cx} cy={DISC.cy} r={DISC.r} />
            </clipPath>
          </defs>

          {/* 水面：圆盘、等高线、涟漪、落点 */}
          <g className='y-ov-pool' clipPath='url(#y-ov-disc)'>
            <circle
              className='y-ov-disc'
              cx={DISC.cx}
              cy={DISC.cy}
              r={DISC.r}
              fill='url(#y-ov-pool)'
            />
            {/* 水面油膜：两层反向自转的虹彩，颜色互相叠加 */}
            <circle
              className='y-ov-iris'
              cx={DISC.cx}
              cy={DISC.cy}
              r={DISC.r}
              fill='url(#y-ov-iris)'
            />
            <circle
              className='y-ov-iris y-ov-iris-2'
              cx={DISC.cx}
              cy={DISC.cy}
              r={DISC.r}
              fill='url(#y-ov-iris-2)'
            />
            {/* 水面镜面高光：一条缓慢漂移的亮带 */}
            <ellipse
              className='y-ov-sheen'
              cx={DISC.cx}
              cy={DISC.cy - 90}
              rx='220'
              ry='10'
              fill='url(#y-ov-sheen)'
            />
            {/* 落点水雾：水砸下来后一直不散的湿气 */}
            <circle
              className='y-ov-mist'
              cx={DISC.cx}
              cy={DISC.cy}
              r='150'
              fill='url(#y-ov-mist)'
            />
            <ellipse
              className='y-ov-contour'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='246'
              ry='214'
            />
            <ellipse
              className='y-ov-contour y-ov-contour-b'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='182'
              ry='156'
            />
            <ellipse
              className='y-ov-contour y-ov-contour-c'
              cx={DISC.cx}
              cy={DISC.cy}
              rx='116'
              ry='98'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-a'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-b'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-c'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            {/* 水一直在落，水面就一直有波纹 */}
            <circle
              className='y-ov-ripple y-ov-ripple-live y-ov-ripple-live-a'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-ripple y-ov-ripple-live y-ov-ripple-live-b'
              cx={DISC.cx}
              cy={DISC.cy}
              r='64'
            />
            <circle
              className='y-ov-flash'
              cx={DISC.cx}
              cy={DISC.cy}
              r='86'
              fill='url(#y-ov-flash)'
            />
            <circle className='y-ov-core' cx={DISC.cx} cy={DISC.cy} r='2.6' />
          </g>

          {/* 板块：真实的 Voronoi 单元，整组缓慢回正 */}
          <g className='y-ov-crust' clipPath='url(#y-ov-disc)'>
            {PLATES.map((plate, i) => (
              <path
                key={plate.label}
                className='y-ov-cell'
                d={plate.d}
                fill={plate.fill}
                style={{ animationDelay: `${3000 + i * 140}ms` }}
              />
            ))}
          </g>

          {/* 水束与粒子：从画面外持续落到水面，覆盖在板块表面 */}
          <g className='y-ov-stream'>
            {/* 模糊水幕：给水流一点厚度，不是一根线 */}
            <path
              className='y-ov-veil'
              d='M 500 -180 C 522 120, 478 340, 500 600'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            <path
              className='y-ov-fall'
              d='M 500 -160 C 518 120, 482 340, 500 600'
              pathLength={1}
              stroke='url(#y-ov-stream)'
            />
            <path
              className='y-ov-fall y-ov-fall-b'
              d='M 484 -120 C 504 140, 466 340, 490 588'
              pathLength={1}
              stroke='url(#y-ov-stream-2)'
            />
            <path
              className='y-ov-fall y-ov-fall-c'
              d='M 516 -180 C 526 160, 484 360, 508 604'
              pathLength={1}
              stroke='url(#y-ov-stream-3)'
            />
            <path
              className='y-ov-fall y-ov-fall-d'
              d='M 492 -200 C 510 120, 474 330, 496 596'
              pathLength={1}
              stroke='url(#y-ov-stream-2)'
            />
            <path
              className='y-ov-fall y-ov-fall-e'
              d='M 508 -130 C 520 150, 490 350, 504 600'
              pathLength={1}
              stroke='url(#y-ov-stream-3)'
            />
            {FALL_PARTICLES.map((p, i) => {
              const style = {
                animationDelay: `${p.delay}ms`,
                '--ov-lift': `${p.lift}px`,
                '--ov-drift': `${p.drift}px`,
                '--ov-dur': `${p.duration}ms`,
                fill: p.color,
              } as CSSProperties;
              return p.line ? (
                <ellipse
                  key={i}
                  className='y-ov-particle y-ov-particle-line'
                  cx={p.x}
                  cy={DISC.cy}
                  rx={0.65}
                  ry={p.r * 2.6}
                  style={style}
                />
              ) : (
                <circle
                  key={i}
                  className='y-ov-particle'
                  cx={p.x}
                  cy={DISC.cy}
                  r={p.r}
                  style={style}
                />
              );
            })}
            {SPLASH_PARTICLES.map((p, i) => (
              <circle
                key={i}
                className='y-ov-splash'
                cx={DISC.cx}
                cy={DISC.cy}
                r={p.r}
                style={
                  {
                    animationDelay: `${p.delay}ms`,
                    '--ov-sx': `${p.sx}px`,
                    '--ov-sy': `${p.sy}px`,
                    '--ov-sdur': `${p.duration}ms`,
                    fill: p.color,
                  } as CSSProperties
                }
              />
            ))}
          </g>

          {/* 板块名：与四步一一对应，不随板块旋转 */}
          <g className='y-ov-labels'>
            {PLATES.map((plate, i) => (
              <g
                key={plate.label}
                className='y-ov-label'
                style={
                  {
                    '--ov-delay': `${3750 + i * 95}ms`,
                    '--ov-dx': `${plate.dx}px`,
                    '--ov-dy': `${plate.dy}px`,
                  } as CSSProperties
                }
              >
                <text
                  className='y-ov-label-no'
                  x={plate.cx}
                  y={plate.cy - 44}
                  textAnchor='middle'
                >
                  0{i + 1}
                </text>
                <text
                  x={plate.cx}
                  y={plate.cy}
                  textAnchor='middle'
                  dominantBaseline='middle'
                >
                  {plate.label}
                </text>
              </g>
            ))}
          </g>
        </svg>

        <section
          className='y-ov-verse'
          aria-label='开篇引言：泻水置平地，各自东西南北流'
        >
          <VerseLine line={VERSE_LINES[0]} />
          <span className='y-ov-rule' aria-hidden='true' />
          <VerseLine line={VERSE_LINES[1]} />
          <p className='y-ov-sub'>流向不同，不等于走错</p>
          <p className='y-ov-source'>—— 鲍照《拟行路难·其四》</p>
        </section>
      </div>

      {demo ? (
        <span className='y-ov-demo' aria-hidden='true'>
          路演模式
        </span>
      ) : null}

      {seq.phase === 'playing' && (!soundOn || !audioReady) ? (
        <button
          type='button'
          className='y-ov-sound-hint'
          onClick={(e) => {
            e.stopPropagation();
            enableSound();
          }}
        >
          <span className='y-ov-sound-hint-note' aria-hidden='true'>
            ♪
          </span>
          {soundOn ? '点击开启声音' : '声音已关 · 点击开启'}
        </button>
      ) : null}

      <div className='y-ov-controls'>
        <button
          type='button'
          className='y-ov-sound'
          aria-pressed={soundOn}
          title={soundOn ? '关闭朗诵与低频' : '开启朗诵与低频'}
          onClick={(e) => {
            e.stopPropagation();
            toggleSound();
          }}
        >
          <i
            className={`y-ov-sound-dot${soundOn ? ' is-on' : ''}`}
            aria-hidden='true'
          />
          声音 {soundOn ? '开' : '关'}
        </button>
        <button
          type='button'
          className='y-ov-skip'
          onClick={(e) => {
            e.stopPropagation();
            skip();
          }}
        >
          跳过 <span aria-hidden='true'>›</span>
        </button>
      </div>
    </div>
  );
}
