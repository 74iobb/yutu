/**
 * 琥珀色「门槛」：取自真实大厅里那块斜立的黄色装置。
 * 只用形状与光，不引用照片；作为沙盘页的出口意象，不承载数据。
 */
export default function PortalSlab({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`y-portal ${className}`.trim()}
      viewBox='0 0 360 280'
      aria-hidden='true'
      focusable='false'
    >
      <defs>
        <linearGradient id='portal-front' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stopColor='#f7cf72' />
          <stop offset='55%' stopColor='#f0a94f' />
          <stop offset='100%' stopColor='#c2703d' />
        </linearGradient>
        <linearGradient id='portal-side' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor='#8a4a24' />
          <stop offset='100%' stopColor='#3a1e10' />
        </linearGradient>
        <radialGradient id='portal-glow' cx='50%' cy='50%' r='50%'>
          <stop offset='0%' stopColor='#f5c15a' stopOpacity='0.22' />
          <stop offset='100%' stopColor='#f5c15a' stopOpacity='0' />
        </radialGradient>
        <filter
          id='portal-blur'
          x='-50%'
          y='-50%'
          width='200%'
          height='200%'
        >
          <feGaussianBlur stdDeviation='4' />
        </filter>
      </defs>

      <ellipse cx='200' cy='120' rx='150' ry='120' fill='url(#portal-glow)' />
      <ellipse
        cx='220'
        cy='252'
        rx='92'
        ry='13'
        fill='rgba(0,0,0,0.5)'
        filter='url(#portal-blur)'
      />

      {/* 右侧厚度 */}
      <polygon
        points='258,52 300,68 300,246 258,232'
        fill='url(#portal-side)'
      />
      {/* 正面 */}
      <polygon
        points='150,34 258,52 258,232 150,220'
        fill='url(#portal-front)'
      />
      {/* 顶部与左侧受光边 */}
      <polyline
        points='150,34 258,52'
        fill='none'
        stroke='rgba(255,236,190,0.85)'
        strokeWidth='2'
      />
      <polyline
        points='150,34 150,220'
        fill='none'
        stroke='rgba(255,225,170,0.35)'
        strokeWidth='1.2'
      />
      {/* 一条蚀刻缝，像真的装置 */}
      <line
        x1='204'
        y1='44'
        x2='204'
        y2='226'
        stroke='rgba(80,40,18,0.18)'
        strokeWidth='1'
      />
      {/* 地面倒影 */}
      <polygon
        points='150,220 258,232 258,268 150,252'
        fill='url(#portal-front)'
        opacity='0.12'
        filter='url(#portal-blur)'
      />
    </svg>
  );
}
