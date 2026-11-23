/**
 * 电气控制示意图的共用 SVG 符号。
 * 仅用于本项目的「电气实训」页面，不承担真实工程制图标准。
 */

export const EL = {
  wire: '#6d84a4',
  dim: '#3f526b',
  amber: '#ffc857',
  cyan: '#6fe3d0',
  green: '#8fe0a8',
  red: '#ff9b8b',
  ink: '#dbe6ff',
  muted: '#8fa3c2',
};

export function Wire({
  d,
  live = false,
  color = EL.amber,
  width = 2,
  dashed = false,
}: {
  d: string;
  live?: boolean;
  color?: string;
  width?: number;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      fill='none'
      stroke={live ? color : EL.wire}
      strokeWidth={width}
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeDasharray={dashed ? '5 5' : undefined}
      opacity={live ? 1 : 0.9}
      className={live ? 'elab-flow' : undefined}
    />
  );
}

export function NodeDot({
  x,
  y,
  live = false,
}: {
  x: number;
  y: number;
  live?: boolean;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r={3}
      fill={live ? EL.amber : EL.wire}
      stroke='rgba(4,8,18,.8)'
      strokeWidth={1}
    />
  );
}

type ContactKind = 'NO' | 'NC' | 'KT';

/**
 * 竖向触点。closed 表示当前处于闭合状态；live 表示该支路有电。
 */
export function VContact({
  x,
  y,
  h = 50,
  closed = false,
  live = false,
  kind = 'NO',
  label,
  sub,
  side = 'right',
  color,
  button = false,
}: {
  x: number;
  y: number;
  h?: number;
  closed?: boolean;
  live?: boolean;
  kind?: ContactKind;
  label?: string;
  sub?: string;
  side?: 'left' | 'right';
  color?: string;
  button?: boolean;
}) {
  const mid = y + h / 2;
  const stroke = live ? color || EL.amber : EL.wire;
  const bladeX = closed ? x : x + 12;
  const bladeY = mid - 11;
  const labelX = side === 'right' ? x + 14 : x - 14;
  const anchor = side === 'right' ? 'start' : 'end';

  return (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={mid - 12}
        stroke={stroke}
        strokeWidth={2}
      />
      <line
        x1={x}
        y1={mid + 12}
        x2={x}
        y2={y + h}
        stroke={stroke}
        strokeWidth={2}
      />
      <circle cx={x} cy={mid - 12} r={2.4} fill={stroke} />
      <circle cx={x} cy={mid + 12} r={2.4} fill={stroke} />
      <line
        x1={x}
        y1={mid + 12}
        x2={bladeX}
        y2={bladeY}
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinecap='round'
      />
      {kind === 'NC' ? (
        <line
          x1={x - 6}
          y1={mid - 12}
          x2={x + 6}
          y2={mid - 12}
          stroke={stroke}
          strokeWidth={1.6}
        />
      ) : null}
      {kind === 'KT' ? (
        <path
          d={`M ${x - 6} ${mid - 4} a 7 7 0 0 1 0 12`}
          fill='none'
          stroke={stroke}
          strokeWidth={1.5}
        />
      ) : null}
      {button ? (
        <g>
          <rect
            x={x - 11}
            y={mid - 4}
            width={6}
            height={8}
            rx={1.2}
            fill='none'
            stroke={stroke}
            strokeWidth={1.2}
          />
          <line
            x1={x - 11}
            y1={mid}
            x2={x - 5}
            y2={mid}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray='2 2'
          />
        </g>
      ) : null}
      <circle
        cx={x}
        cy={mid}
        r={10}
        fill={live ? stroke : 'transparent'}
        opacity={live ? 0.1 : 0}
      />
      {label ? (
        <text
          x={labelX}
          y={mid - 2}
          textAnchor={anchor}
          fontSize={11.5}
          fontWeight={700}
          fill={live ? stroke : EL.ink}
        >
          {label}
        </text>
      ) : null}
      {sub ? (
        <text
          x={labelX}
          y={mid + 12}
          textAnchor={anchor}
          fontSize={9.5}
          fill={EL.muted}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function Coil({
  x,
  y,
  label,
  sub,
  on = false,
  color = EL.amber,
  w = 62,
  h = 24,
}: {
  x: number;
  y: number;
  label: string;
  sub?: string;
  on?: boolean;
  color?: string;
  w?: number;
  h?: number;
}) {
  const c = on ? color : EL.wire;
  return (
    <g className={on ? 'elab-coil is-on' : 'elab-coil'}>
      {on ? (
        <rect
          x={x - w / 2 - 6}
          y={y - h / 2 - 6}
          width={w + 12}
          height={h + 12}
          rx={9}
          fill={color}
          opacity={0.14}
        />
      ) : null}
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={3}
        fill={on ? 'rgba(255,200,87,.14)' : 'rgba(12,24,46,.82)'}
        stroke={c}
        strokeWidth={2}
      />
      <text
        x={x}
        y={y + 4}
        textAnchor='middle'
        fontSize={11}
        fontWeight={700}
        fill={on ? color : EL.ink}
      >
        {label}
      </text>
      {sub ? (
        <text
          x={x}
          y={y + h / 2 + 13}
          textAnchor='middle'
          fontSize={9}
          fill={EL.muted}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function Fuse({
  x,
  y,
  h = 26,
  vertical = true,
}: {
  x: number;
  y: number;
  h?: number;
  vertical?: boolean;
}) {
  if (!vertical) {
    return (
      <g>
        <rect
          x={x}
          y={y - 6}
          width={h}
          height={12}
          rx={2}
          fill='rgba(12,24,46,.85)'
          stroke={EL.wire}
          strokeWidth={1.6}
        />
        <line x1={x} y1={y} x2={x + h} y2={y} stroke={EL.wire} strokeWidth={1.2} />
      </g>
    );
  }
  return (
    <g>
      <rect
        x={x - 6}
        y={y}
        width={12}
        height={h}
        rx={2}
        fill='rgba(12,24,46,.85)'
        stroke={EL.wire}
        strokeWidth={1.6}
      />
      <line
        x1={x}
        y1={y}
        x2={x}
        y2={y + h}
        stroke={EL.wire}
        strokeWidth={1.2}
      />
    </g>
  );
}

export function PhaseDot({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={3.5}
        fill='rgba(12,24,46,.9)'
        stroke={EL.wire}
        strokeWidth={1.5}
      />
      <text
        x={x}
        y={y - 9}
        textAnchor='middle'
        fontSize={10}
        fill={EL.muted}
      >
        {label}
      </text>
    </g>
  );
}
