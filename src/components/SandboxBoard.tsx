import {
  SANDBOX_ACTION_MAP,
  SANDBOX_ROUNDS,
  type SandboxActionId,
} from '@/lib/sandbox';

interface Pt {
  x: number;
  y: number;
}

const W = 860;
const H = 500;
const HEX_R = 34;
const START: Pt = { x: 72, y: 356 };
const BASE_Y = 434;

/** 六格的位置：一条起伏向上的路径 */
const POS: Pt[] = [
  { x: 190, y: 300 },
  { x: 305, y: 342 },
  { x: 420, y: 262 },
  { x: 535, y: 304 },
  { x: 650, y: 224 },
  { x: 765, y: 266 },
];

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** 用二次贝塞尔把折线抹圆，避免棋盘连接线出现硬拐角 */
function smoothPath(pts: Pt[]): string {
  if (!pts.length) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export default function SandboxBoard({
  picks,
  focus,
  startHue,
  baseEndLabel,
  onTile,
}: {
  picks: SandboxActionId[];
  /** 正在查看的格序号；null 表示正在看「下一格」 */
  focus: number | null;
  startHue: string;
  baseEndLabel: string;
  onTile: (i: number) => void;
}) {
  const done = Math.min(picks.length, SANDBOX_ROUNDS);
  const tokenPos = done === 0 ? START : POS[done - 1];
  /* 棋子落在棋格右下角，避免盖住格子中间的字 */
  const tokenShift = done === 0 ? { x: 0, y: 0 } : { x: 24, y: 16 };
  const planPts = [START, ...POS.slice(0, done)];
  const restPts = POS.slice(Math.max(0, done - 1));
  const next = done < SANDBOX_ROUNDS ? done : -1;

  return (
    <svg
      className='y-sb-board'
      viewBox={`0 0 ${W} ${H}`}
      role='img'
      aria-label={`沙盘推演棋盘：已落 ${done} 格，共 ${SANDBOX_ROUNDS} 格`}
    >
      <defs>
        <linearGradient id='sb-sky' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='rgba(96,142,255,0.13)' />
          <stop offset='58%' stopColor='rgba(96,142,255,0.03)' />
          <stop offset='100%' stopColor='rgba(6,12,26,0)' />
        </linearGradient>
        <linearGradient id='sb-plan' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor='#8fd6c0' />
          <stop offset='52%' stopColor='#7fb6ff' />
          <stop offset='100%' stopColor='#f5c15a' />
        </linearGradient>
        <radialGradient id='sb-marble'>
          <stop offset='0%' stopColor='#ffffff' />
          <stop offset='32%' stopColor='#cfe3ff' />
          <stop offset='72%' stopColor='#6fa8ff' />
          <stop offset='100%' stopColor='#2d4f8a' />
        </radialGradient>
        <radialGradient id='sb-core'>
          <stop offset='0%' stopColor='rgba(255,255,255,0.85)' />
          <stop offset='55%' stopColor='rgba(127,182,255,0.28)' />
          <stop offset='100%' stopColor='rgba(127,182,255,0)' />
        </radialGradient>
        <pattern
          id='sb-grid'
          width='38'
          height='38'
          patternUnits='userSpaceOnUse'
        >
          <path
            d='M 38 0 L 0 0 0 38'
            fill='none'
            stroke='rgba(160,190,255,0.10)'
            strokeWidth='1'
          />
        </pattern>
        <clipPath id='sb-clip'>
          <rect x='0' y='0' width={W} height={H} rx='14' />
        </clipPath>
        <filter id='sb-soft' x='-60%' y='-60%' width='220%' height='220%'>
          <feGaussianBlur stdDeviation='7' />
        </filter>
      </defs>

      <g clipPath='url(#sb-clip)'>
        <rect width={W} height={H} fill='url(#sb-sky)' />
        <rect width={W} height={H} fill='url(#sb-grid)' />

        {/* 等高线：只是沙盘的地形暗示，不承载数据 */}
        <g fill='none' stroke='rgba(150,185,255,0.14)' strokeWidth='1'>
          <ellipse cx='430' cy='300' rx='392' ry='186' />
          <ellipse cx='430' cy='300' rx='330' ry='152' />
          <ellipse cx='430' cy='300' rx='268' ry='120' />
          <ellipse cx='430' cy='300' rx='206' ry='88' />
          <ellipse cx='430' cy='300' rx='144' ry='58' />
        </g>
        <g fill='rgba(160,190,255,0.5)' fontSize='10' fontFamily='monospace'>
          <text x='18' y='26'>SANDBOX · 6 QUARTERS</text>
          <text x={W - 18} y='26' textAnchor='end'>
            FIXED RULES · NO RANDOM
          </text>
        </g>

        {/* 维持现状对照轨 */}
        <g>
          <path
            d={`M ${START.x} ${BASE_Y} L ${POS[POS.length - 1].x} ${BASE_Y}`}
            stroke='rgba(160,190,255,0.28)'
            strokeWidth='1.4'
            strokeDasharray='4 7'
            fill='none'
          />
          {POS.map((p, i) => (
            <circle
              key={`b-${i}`}
              cx={p.x}
              cy={BASE_Y}
              r='4'
              fill='rgba(160,190,255,0.32)'
              stroke='rgba(160,190,255,0.5)'
              strokeWidth='1'
            />
          ))}
          <text
            x={START.x}
            y={BASE_Y - 14}
            fill='rgba(183,197,228,0.7)'
            fontSize='11'
          >
            维持现状
          </text>
          <text
            x={POS[POS.length - 1].x}
            y={BASE_Y + 20}
            textAnchor='end'
            fill='rgba(183,197,228,0.75)'
            fontSize='11'
          >
            {baseEndLabel}
          </text>
        </g>

        {/* 已走过的路线 */}
        {done > 0 ? (
          <path
            d={smoothPath(planPts)}
            fill='none'
            stroke='url(#sb-plan)'
            strokeWidth='3'
            strokeLinecap='round'
            className='sb-plan-line'
          />
        ) : null}
        {/* 到下一格的虚线 */}
        {next >= 0 ? (
          <path
            d={smoothPath(restPts)}
            fill='none'
            stroke='rgba(245,193,90,0.5)'
            strokeWidth='1.8'
            strokeDasharray='5 8'
            strokeLinecap='round'
          />
        ) : null}

        {/* 起点 */}
        <g>
          <circle cx={START.x} cy={START.y} r='9' fill='none' stroke={startHue} strokeWidth='2' />
          <circle cx={START.x} cy={START.y} r='3.4' fill={startHue} />
          <text
            x={START.x}
            y={START.y + 40}
            textAnchor='middle'
            fill='rgba(183,197,228,0.9)'
            fontSize='11.5'
          >
            现在
          </text>
        </g>

        {/* 六格 */}
        {POS.map((p, i) => {
          const filled = i < done;
          const act = filled ? SANDBOX_ACTION_MAP[picks[i]] : null;
          const isNext = i === next;
          const isFocus = focus === i;
          const cls = [
            'sb-hex',
            filled ? 'is-done' : '',
            isNext ? 'is-next' : '',
            !filled && !isNext ? 'is-locked' : '',
            isFocus ? 'is-focus' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const label = act
            ? `第 ${i + 1} 格：${act.name}`
            : isNext
              ? `第 ${i + 1} 格：选择动作`
              : `第 ${i + 1} 格：未解锁`;
          return (
            <g
              key={`t-${i}`}
              className={cls}
              role='button'
              tabIndex={filled || isNext ? 0 : -1}
              aria-label={label}
              aria-disabled={!filled && !isNext}
              onClick={() => {
                if (filled || isNext) onTile(i);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                if (!filled && !isNext) return;
                e.preventDefault();
                onTile(i);
              }}
            >
              {isNext ? (
                <>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={HEX_R + 16}
                    fill='url(#sb-core)'
                    className='sb-hex-glow'
                  />
                  <polygon
                    points={hexPoints(p.x, p.y, HEX_R + 9)}
                    fill='none'
                    stroke='rgba(245,193,90,0.4)'
                    strokeWidth='1'
                    strokeDasharray='2 6'
                    className='sb-hex-halo'
                  />
                </>
              ) : null}
              {isFocus ? (
                <polygon
                  points={hexPoints(p.x, p.y, HEX_R + 7)}
                  fill='none'
                  stroke='rgba(255,255,255,0.85)'
                  strokeWidth='1.4'
                  strokeDasharray='3 4'
                />
              ) : null}
              <polygon
                points={hexPoints(p.x, p.y, HEX_R)}
                className='sb-hex-body'
                fill={act ? `${act.hue}22` : 'rgba(10,20,40,0.72)'}
                stroke={
                  act
                    ? act.hue
                    : isNext
                      ? 'rgba(245,193,90,0.95)'
                      : 'rgba(160,190,255,0.28)'
                }
                strokeWidth={act ? 1.8 : 1.3}
                strokeDasharray={act || isNext ? undefined : '4 5'}
              />
              <polygon
                points={hexPoints(p.x, p.y - 2, HEX_R - 7)}
                className='sb-hex-top'
                fill={act ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}
                stroke='none'
              />
              <text
                x={p.x}
                y={p.y - 13}
                textAnchor='middle'
                className='sb-hex-no'
              >
                {String(i + 1).padStart(2, '0')}
              </text>
              <text
                x={p.x}
                y={p.y + 15}
                textAnchor='middle'
                className='sb-hex-code'
                fill={act ? act.hue : isNext ? 'rgba(245,193,90,0.9)' : 'rgba(160,190,255,0.4)'}
              >
                {act ? act.code : isNext ? '+' : '·'}
              </text>
              <text
                x={p.x}
                y={p.y + HEX_R + 20}
                textAnchor='middle'
                className='sb-hex-q'
              >
                Q{i + 1}
              </text>
            </g>
          );
        })}

        {/* 棋子：停在最后一格 */}
        <g
          className='sb-token'
          transform={`translate(${tokenPos.x + tokenShift.x} ${
            tokenPos.y + tokenShift.y
          })`}
          aria-hidden='true'
        >
          <circle
            r={done === 0 ? 24 : 20}
            fill='url(#sb-core)'
            className='sb-token-glow'
          />
          <circle r={done === 0 ? 11.5 : 10} fill='url(#sb-marble)' />
          <circle
            r={done === 0 ? 11.5 : 10}
            fill='none'
            stroke='rgba(255,255,255,0.75)'
            strokeWidth='1.4'
          />
          <ellipse
            cx='-3.2'
            cy='-3.8'
            rx='3.1'
            ry='2'
            fill='rgba(255,255,255,0.9)'
          />
        </g>
      </g>
    </svg>
  );
}
