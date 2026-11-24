import type { KeyboardEvent } from 'react';
import marble from '@/assets/loop-marble.webp';

export type LoopStationKey =
  | 'claim'
  | 'act'
  | 'mark'
  | 'dock'
  | 'archive'
  | 'map';

export interface LoopMapProps {
  /** 当前轮次（= 已归档次数 + 1） */
  round: number;
  /** 本轮未归档任务数 */
  active: number;
  /** 本轮进行中 */
  doing: number;
  /** 本轮已完成待归档 */
  ready: number;
  /** 已完成的闭环次数 */
  victories: number;
  onGo: (k: LoopStationKey) => void;
}

export interface LoopStation {
  k: LoopStationKey;
  name: string;
  hint: string;
  desc: string;
}

/** 闭环的固定顺序：第 4 步的版面也按这个顺序排 */
export const LOOP_STATIONS: LoopStation[] = [
  {
    k: 'claim',
    name: '领取任务',
    hint: '工作台',
    desc: '从当前域载入参考任务，或自己写一条',
  },
  {
    k: 'act',
    name: '去体验',
    hint: '线下',
    desc: '把这条体验在真实生活里做一遍',
  },
  {
    k: 'mark',
    name: '标记完成',
    hint: '工作台',
    desc: '做完之后，在任务上标记「已完成」',
  },
  {
    k: 'dock',
    name: '停靠自省',
    hint: '驿站',
    desc: '回到驿站，回答三个问题',
  },
  {
    k: 'archive',
    name: '归档漂移',
    hint: '驿站',
    desc: '归档为阶段性胜利，位置小幅漂移',
  },
  {
    k: 'map',
    name: '回看落点',
    hint: '第 3 步',
    desc: '回到方向与推演，看新的归属与漂移',
  },
];

const CX = 200;
const CY = 200;
const R = 100;

/** 弹珠贴内沿滚动，避开站点编号 */
const MARBLE_Y = CY - R + 24;

/** 弹珠右下边缘的弧形反光（20° → 110°） */
const MARBLE_RIM_PATH = (() => {
  const rr = 13;
  const a1 = (20 * Math.PI) / 180;
  const a2 = (110 * Math.PI) / 180;
  const p1 = { x: CX + rr * Math.cos(a1), y: MARBLE_Y + rr * Math.sin(a1) };
  const p2 = { x: CX + rr * Math.cos(a2), y: MARBLE_Y + rr * Math.sin(a2) };
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} A${rr},${rr} 0 0 1 ${p2.x.toFixed(
    1
  )},${p2.y.toFixed(1)}`;
})();

function stationPoint(i: number) {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), a };
}

/** 当前应高亮的站点：新一轮一律从「领取任务」开始 */
export function loopStationIndex(active: number, doing: number, ready: number) {
  if (active === 0) return 0;
  if (ready > 0) return 3;
  if (doing > 0) return 2;
  return 1;
}

/** 环形进度：0–6，6 表示一轮完整闭合；新一轮从 0 开始 */
function segments(active: number, doing: number, ready: number) {
  if (active === 0) return 0.4;
  if (ready > 0) return 4;
  if (doing > 0) return 2;
  return 1;
}

export default function LoopMap({
  round,
  active,
  doing,
  ready,
  victories,
  onGo,
}: LoopMapProps) {
  const idx = loopStationIndex(active, doing, ready);
  const seg = segments(active, doing, ready);
  const progress = Math.max(0, Math.min(1, seg / 6));
  const C = 2 * Math.PI * R;

  const centerMain =
    active === 0 && victories === 0
      ? '闭环从这里开始'
      : active === 0
        ? `第 ${round} 轮待启动`
        : ready > 0
          ? `${ready} 条待归档`
          : doing > 0
            ? `${doing} 条进行中`
            : '本轮任务在手';

  const centerSub =
    active === 0 && victories === 0
      ? '领一条任务，开始第一次体验'
      : active === 0
        ? '上一轮已归档；领取任务，开始新一轮'
        : ready > 0
          ? '去驿站完成停靠，闭合本轮'
          : doing > 0
            ? '做完后标记完成，回到闭环'
            : '到工作台继续或新增一条';

  function activate(k: LoopStationKey) {
    onGo(k);
  }

  function onKey(e: KeyboardEvent<SVGGElement>, k: LoopStationKey) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      activate(k);
    }
  }

  return (
    <div className='y-loop-map'>
      <svg
        viewBox='0 0 400 400'
        role='group'
        aria-label={`成长闭环轮盘：第 ${round} 轮，${centerMain}`}
      >
        <title>成长闭环轮盘</title>
        <desc>
          六个站点依次为领取任务、去体验、标记完成、停靠自省、归档漂移、回看落点。点击任意站点可直接前往。
        </desc>

        <defs>
          <clipPath id='y-loop-marble-clip'>
            <circle cx={CX} cy={MARBLE_Y} r={14} />
          </clipPath>
          {/* 球面明暗：左上亮、边缘压暗，制造体积 */}
          <radialGradient
            id='y-loop-marble-shade'
            cx='34%'
            cy='28%'
            r='72%'
          >
            <stop offset='0%' stopColor='#ffffff' stopOpacity='0' />
            <stop offset='52%' stopColor='#000000' stopOpacity='0.05' />
            <stop offset='82%' stopColor='#000000' stopOpacity='0.34' />
            <stop offset='100%' stopColor='#000000' stopOpacity='0.72' />
          </radialGradient>
          {/* 右下反光，补一层环境光 */}
          <radialGradient
            id='y-loop-marble-bounce'
            cx='72%'
            cy='80%'
            r='46%'
          >
            <stop offset='0%' stopColor='#cfe9ff' stopOpacity='0.28' />
            <stop offset='100%' stopColor='#cfe9ff' stopOpacity='0' />
          </radialGradient>
          {/* 镜面高光 */}
          <radialGradient id='y-loop-marble-spec' cx='50%' cy='50%' r='50%'>
            <stop offset='0%' stopColor='#ffffff' stopOpacity='0.95' />
            <stop offset='45%' stopColor='#ffffff' stopOpacity='0.35' />
            <stop offset='100%' stopColor='#ffffff' stopOpacity='0' />
          </radialGradient>
          <filter
            id='y-loop-marble-shadow'
            x='-80%'
            y='-80%'
            width='260%'
            height='260%'
          >
            <feGaussianBlur stdDeviation='2.4' />
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R + 15} className='y-loop-track2' />
        <circle cx={CX} cy={CY} r={R} className='y-loop-track' />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          className='y-loop-arc'
          transform={`rotate(-90 ${CX} ${CY})`}
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - progress)}
        />

        <g className='y-loop-orbit y-loop-orbit-b' aria-hidden='true'>
          <circle cx={CX} cy={CY - R} r={2.1} />
        </g>
        <g className='y-loop-orbit-fast' aria-hidden='true'>
          <circle cx={CX} cy={CY - R} r={1.5} />
        </g>

        {LOOP_STATIONS.map((s, i) => {
          const p = stationPoint(i);
          const passed = i < idx;
          const on = i === idx;
          const labelR = R + 48;
          const lx = CX + Math.cos(p.a) * labelR;
          const ly = CY + Math.sin(p.a) * labelR;
          const subY =
            Math.abs(Math.sin(p.a)) > 0.9
              ? ly + Math.sin(p.a) * -12
              : ly + (Math.sin(p.a) > 0 ? 13 : -13);
          return (
            <g
              key={s.k}
              className={`y-loop-station${on ? ' is-active' : ''}${
                passed ? ' is-passed' : ''
              }`}
              role='button'
              tabIndex={0}
              aria-label={`${s.name}：${s.desc}`}
              aria-current={on ? 'step' : undefined}
              onClick={() => activate(s.k)}
              onKeyDown={(e) => onKey(e, s.k)}
            >
              <title>{`${s.name} · ${s.desc}`}</title>
              <circle cx={p.x} cy={p.y} r={19} className='y-loop-node' />
              {passed ? (
                <path
                  d={`M${p.x - 5.5},${p.y + 0.5} l4,4 l7.5,-8`}
                  className='y-loop-check'
                />
              ) : (
                <text x={p.x} y={p.y + 4} textAnchor='middle' className='y-loop-idx'>
                  {i + 1}
                </text>
              )}
              <text x={lx} y={ly} textAnchor='middle' className='y-loop-lbl'>
                {s.name}
              </text>
              <text
                x={lx}
                y={subY}
                textAnchor='middle'
                className='y-loop-hint'
              >
                {on ? '你在这里' : s.hint}
              </text>
            </g>
          );
        })}

        {/* 弹珠：彩绘玻璃纹理，沿闭环滚动；画在站点之上，避免被节点盖住 */}
        <g className='y-loop-orbit' aria-hidden='true'>
          <ellipse
            cx={CX}
            cy={MARBLE_Y + 5}
            rx={13}
            ry={8}
            fill='rgba(0,0,0,0.45)'
            filter='url(#y-loop-marble-shadow)'
          />
          <image
            href={marble}
            x={CX - 14}
            y={MARBLE_Y - 14}
            width={28}
            height={28}
            preserveAspectRatio='xMidYMid slice'
            clipPath='url(#y-loop-marble-clip)'
            className='y-loop-marble'
          />
          {/* 球面明暗 + 右下环境反光（用 ellipse 绕开 .y-loop-orbit circle 的橙色填充） */}
          <ellipse
            cx={CX}
            cy={MARBLE_Y}
            rx={14}
            ry={14}
            fill='url(#y-loop-marble-shade)'
          />
          <ellipse
            cx={CX}
            cy={MARBLE_Y}
            rx={14}
            ry={14}
            fill='url(#y-loop-marble-bounce)'
          />
          {/* 右下边缘反光 */}
          <path d={MARBLE_RIM_PATH} className='y-loop-marble-rim' />
          {/* 左上镜面高光 */}
          <ellipse
            cx={CX - 4.5}
            cy={MARBLE_Y - 5.5}
            rx={5}
            ry={3.2}
            fill='url(#y-loop-marble-spec)'
          />
          {/* 最外圈极细白边，收住轮廓 */}
          <ellipse
            cx={CX}
            cy={MARBLE_Y}
            rx={14}
            ry={14}
            fill='none'
            stroke='rgba(255,255,255,0.38)'
            strokeWidth={0.8}
          />
        </g>

        <text x={CX} y={CY - 24} textAnchor='middle' className='y-loop-round'>
          第 {round} 轮
        </text>
        <text x={CX} y={CY + 2} textAnchor='middle' className='y-loop-state'>
          {centerMain}
        </text>
        <text x={CX} y={CY + 22} textAnchor='middle' className='y-loop-note'>
          {centerSub}
        </text>
        <text x={CX} y={CY + 46} textAnchor='middle' className='y-loop-count'>
          已完成 {victories} 次闭环
        </text>
      </svg>
    </div>
  );
}
