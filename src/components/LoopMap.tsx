import type { KeyboardEvent } from 'react';
import marble from '@/assets/loop-marble.webp';
import FlowerBloom from './FlowerBloom';

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
    name: '归档',
    hint: '驿站',
    desc: '归档为阶段性胜利，处境是否变化由你判断',
  },
  {
    k: 'map',
    name: '回看落点',
    hint: '第 3 步',
    desc: '回到方向与推演，看归属有没有变化',
  },
];

const CX = 200;
const CY = 200;
/** 当前轮的环 */
const R = 120;
/** 站点标签半径 */
const LABEL_R = 166;
const NODE_R = 16;
/** 棋子半径 */
const TOKEN_R = 13;
/** 棋子就停在当前站点上，作为“你在这里”的实体标记 */
const TOKEN_ORBIT = R;

function stationPoint(i: number, radius = R) {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a), a };
}

/** 当前应高亮的站点：新一轮一律从「领取任务」开始 */
export function loopStationIndex(active: number, doing: number, ready: number) {
  if (active === 0) return 0;
  if (ready > 0) return 3;
  if (doing > 0) return 2;
  return 1;
}

/** 已完成轮次的内圈：最多画 3 圈，避免挤占中心文字 */
function pastRings(victories: number) {
  const count = Math.min(Math.max(0, victories), 3);
  return Array.from({ length: count }, (_, k) => ({
    /* 与当前节点内沿留 4px、与中心圆留 4px */
    r: R - (k + 1) * 20,
    opacity: 0.42 - k * 0.09,
  }));
}

/** 中心说明最多两行，避免横向穿过环线 */
function splitCenter(text: string): string[] {
  if (text.length <= 13) return [text];
  const cut = text.search(/[；，]/);
  if (cut > 3) return [text.slice(0, cut), text.slice(cut + 1)];
  const mid = Math.ceil(text.length / 2);
  return [text.slice(0, mid), text.slice(mid)];
}

function marbleRim(tx: number, ty: number) {
  const rr = 11;
  const a1 = (20 * Math.PI) / 180;
  const a2 = (110 * Math.PI) / 180;
  const p1 = { x: tx + rr * Math.cos(a1), y: ty + rr * Math.sin(a1) };
  const p2 = { x: tx + rr * Math.cos(a2), y: ty + rr * Math.sin(a2) };
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} A${rr},${rr} 0 0 1 ${p2.x.toFixed(
    1
  )},${p2.y.toFixed(1)}`;
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
  /* 弧线停在当前站点与下一站之间，而不是“已完成格数” */
  const progress = Math.min(1, (active === 0 ? 0.45 : idx + 0.55) / 6);
  const C = 2 * Math.PI * R;
  const rings = pastRings(victories);
  const token = stationPoint(idx, TOKEN_ORBIT);
  const rim = marbleRim(token.x, token.y);
  const nextIdx = idx < LOOP_STATIONS.length - 1 ? idx + 1 : -1;

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
  const subLines = splitCenter(centerSub);
  const countY = CY + 20 + subLines.length * 12 + 5;

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
        aria-label={`成长闭环螺旋：第 ${round} 轮，${centerMain}`}
      >
        <title>成长闭环</title>
        <desc>
          外圈是当前一轮的六个站点：领取任务、去体验、标记完成、停靠自省、归档、回看落点；
          内圈是已完成的轮次。点击任意站点可直接前往。
        </desc>

        <defs>
          <clipPath id='y-loop-marble-clip'>
            <circle cx={token.x} cy={token.y} r={TOKEN_R} />
          </clipPath>
          <linearGradient
            id='y-loop-arc-grad'
            gradientUnits='userSpaceOnUse'
            x1='40'
            y1='360'
            x2='360'
            y2='40'
          >
            <stop offset='0%' stopColor='#8fd6c0' />
            <stop offset='52%' stopColor='#7fb6ff' />
            <stop offset='100%' stopColor='#f5c15a' />
          </linearGradient>
          <radialGradient id='y-loop-core-grad' cx='50%' cy='42%' r='62%'>
            <stop offset='0%' stopColor='rgba(64,104,180,0.34)' />
            <stop offset='62%' stopColor='rgba(24,44,86,0.24)' />
            <stop offset='100%' stopColor='rgba(8,16,32,0)' />
          </radialGradient>
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
          <radialGradient
            id='y-loop-marble-bounce'
            cx='72%'
            cy='80%'
            r='46%'
          >
            <stop offset='0%' stopColor='#cfe9ff' stopOpacity='0.28' />
            <stop offset='100%' stopColor='#cfe9ff' stopOpacity='0' />
          </radialGradient>
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

        {/* 与七维雷达同一朵彩虹花：铺在闭环螺旋下面 */}
        <FlowerBloom cx={CX} cy={CY} r={150} />

        {/* 已完成轮次：内圈年轮 */}
        {rings.map((ring) => (
          <g key={ring.r} opacity={ring.opacity}>
            <circle
              cx={CX}
              cy={CY}
              r={ring.r}
              className='y-loop-past-ring'
            />
            {LOOP_STATIONS.map((s, i) => {
              const p = stationPoint(i, ring.r);
              return (
                <circle
                  key={s.k}
                  cx={p.x}
                  cy={p.y}
                  r={2.2}
                  className='y-loop-past-dot'
                />
              );
            })}
          </g>
        ))}

        {/* 外圈：当前轮 */}
        <circle cx={CX} cy={CY} r={R + 12} className='y-loop-track2' />
        <circle cx={CX} cy={CY} r={R} className='y-loop-track' />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          className='y-loop-arc'
          transform={`rotate(-90 ${CX} ${CY})`}
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - progress)}
          style={{ stroke: 'url(#y-loop-arc-grad)' }}
        />

        {LOOP_STATIONS.map((s, i) => {
          const a = stationPoint(i, R - 7);
          const b = stationPoint(i, R + 7);
          return (
            <line
              key={`tick-${s.k}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className='y-loop-tick'
            />
          );
        })}

        {LOOP_STATIONS.map((s, i) => {
          const p = stationPoint(i, R);
          const passed = i < idx;
          const on = i === idx;
          const isNext = i === nextIdx;
          const label = stationPoint(i, LABEL_R);
          const hintY =
            Math.sin(p.a) < -0.85 ? label.y - 13 : label.y + 13;
          return (
            <g
              key={s.k}
              className={`y-loop-station${on ? ' is-active' : ''}${
                passed ? ' is-passed' : ''
              }${isNext ? ' is-next' : ''}`}
              role='button'
              tabIndex={0}
              aria-label={`${s.name}：${s.desc}`}
              aria-current={on ? 'step' : undefined}
              onClick={() => activate(s.k)}
              onKeyDown={(e) => onKey(e, s.k)}
            >
              <title>{`${s.name} · ${s.desc}`}</title>
              {on ? (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={NODE_R + 10}
                  className='y-loop-node-halo'
                />
              ) : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                className='y-loop-node'
              />
              {passed ? (
                <path
                  d={`M${p.x - 4.6},${p.y + 0.4} l3.4,3.6 l6.4,-7`}
                  className='y-loop-check'
                />
              ) : on ? null : (
                <text
                  x={p.x}
                  y={p.y + 4}
                  textAnchor='middle'
                  className='y-loop-idx'
                >
                  {i + 1}
                </text>
              )}
              <text x={label.x} y={label.y} textAnchor='middle' className='y-loop-lbl'>
                {s.name}
              </text>
              <text
                x={label.x}
                y={hintY}
                textAnchor='middle'
                className='y-loop-hint'
              >
                {on ? '你在这里' : isNext ? '下一步' : s.hint}
              </text>
            </g>
          );
        })}

        {/* 棋子：停在你当前所在站点，不再无意义地绕圈 */}
        <g className='y-loop-token' aria-hidden='true'>
          <circle
            cx={token.x}
            cy={token.y}
            r={TOKEN_R + 8}
            className='y-loop-token-halo'
          />
          <ellipse
            cx={token.x}
            cy={token.y + 7}
            rx={11}
            ry={6}
            fill='rgba(0,0,0,0.45)'
            filter='url(#y-loop-marble-shadow)'
          />
          <image
            href={marble}
            x={token.x - TOKEN_R}
            y={token.y - TOKEN_R}
            width={TOKEN_R * 2}
            height={TOKEN_R * 2}
            preserveAspectRatio='xMidYMid slice'
            clipPath='url(#y-loop-marble-clip)'
            className='y-loop-marble'
          />
          <ellipse
            cx={token.x}
            cy={token.y}
            rx={TOKEN_R}
            ry={TOKEN_R}
            fill='url(#y-loop-marble-shade)'
          />
          <ellipse
            cx={token.x}
            cy={token.y}
            rx={TOKEN_R}
            ry={TOKEN_R}
            fill='url(#y-loop-marble-bounce)'
          />
          <path d={rim} className='y-loop-marble-rim' />
          <ellipse
            cx={token.x - 4}
            cy={token.y - 5}
            rx={4.6}
            ry={2.9}
            fill='url(#y-loop-marble-spec)'
          />
          <circle
            cx={token.x}
            cy={token.y}
            r={TOKEN_R}
            fill='none'
            stroke='rgba(255,255,255,0.4)'
            strokeWidth={0.8}
          />
        </g>

        {/* 中心：轮次与状态 */}
        <circle cx={CX} cy={CY} r={56} className='y-loop-core-glow' />
        <text x={CX} y={CY - 24} textAnchor='middle' className='y-loop-round'>
          第 {round} 轮
        </text>
        <text x={CX} y={CY + 1} textAnchor='middle' className='y-loop-state'>
          {centerMain}
        </text>
        {subLines.map((line, i) => (
          <text
            key={line + i}
            x={CX}
            y={CY + 20 + i * 12}
            textAnchor='middle'
            className='y-loop-note'
          >
            {line}
          </text>
        ))}
        <text
          x={CX}
          y={countY}
          textAnchor='middle'
          className='y-loop-count'
        >
          已完成 {victories} 次闭环
        </text>

        {victories > 0 ? (
          <g className='y-loop-legend'>
            <circle cx={13} cy={394} r={4} className='y-loop-legend-dot' />
            <text x={22} y={397}>
              {victories > 3 ? '内圈 = 最近 3 轮' : '内圈 = 已完成轮次'}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}
