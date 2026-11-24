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
            <circle cx={CX} cy={CY - R} r={14} />
          </clipPath>
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
            cy={CY - R + 4}
            rx={12}
            ry={8}
            fill='rgba(0,0,0,0.32)'
          />
          <image
            href={marble}
            x={CX - 14}
            y={CY - R - 14}
            width={28}
            height={28}
            preserveAspectRatio='xMidYMid slice'
            clipPath='url(#y-loop-marble-clip)'
            className='y-loop-marble'
          />
          <ellipse
            cx={CX}
            cy={CY - R}
            rx={14}
            ry={14}
            fill='none'
            stroke='rgba(255,255,255,0.55)'
            strokeWidth={1.3}
          />
          <ellipse
            cx={CX - 4.2}
            cy={CY - R - 5}
            rx={4.2}
            ry={2.5}
            fill='rgba(255,255,255,0.55)'
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
