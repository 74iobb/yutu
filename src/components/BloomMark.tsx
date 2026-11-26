/**
 * 迷你彩虹花：用作「次板块」选中按钮的底纹。
 * 纯装饰，不承载数据；旋转由 CSS 控制，关闭动效后静止。
 */
const COLORS = [
  '#ff3b6b',
  '#ff7a45',
  '#ffcf4d',
  '#3fe8a0',
  '#35cfff',
  '#4f7dff',
  '#a96bff',
];

export default function BloomMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 100 100'
      className={className}
      aria-hidden='true'
      focusable='false'
    >
      <g transform='translate(50 50)'>
        {COLORS.map((c, i) => (
          <ellipse
            key={c}
            cx='0'
            cy='-24'
            rx='7.5'
            ry='21'
            fill={c}
            opacity='0.85'
            transform={`rotate(${(i * 360) / COLORS.length})`}
          />
        ))}
        <circle r='7' fill='#fff8e6' opacity='0.9' />
      </g>
    </svg>
  );
}
