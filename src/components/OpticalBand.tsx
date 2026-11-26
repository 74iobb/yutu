/**
 * 每一步顶部的一条“光学带”：
 * - Step1 水下焦散（沉浸、显影）
 * - Step2 退潮海岸（观察、证据）
 * - Step3 彩玻璃（碎片、选择）
 * - Step4 年轮光环（拼合、透光）
 *
 * 纯 SVG/CSS，不依赖外部图片；低对比、可被文字覆盖，
 * 不承载数据，也不拦截点击。
 */
export default function OpticalBand({ step }: { step: number }) {
  if (step === 1) return <WaterBand />;
  if (step === 2) return <ShoreBand />;
  if (step === 3) return <GlassBand />;
  if (step === 4) return <LoopBand />;
  return null;
}

function WaterBand() {
  return (
    <div className='y-optical-band ob-water' aria-hidden='true'>
      <svg viewBox='0 0 1200 240' preserveAspectRatio='none' focusable='false'>
        <defs>
          <linearGradient id='ob-water-base' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#0a2a3a' stopOpacity='0.62' />
            <stop offset='62%' stopColor='#071a2a' stopOpacity='0.2' />
            <stop offset='100%' stopColor='#071224' stopOpacity='0' />
          </linearGradient>
          <radialGradient id='ob-water-glow' cx='72%' cy='24%' r='62%'>
            <stop offset='0%' stopColor='#4fc9e6' stopOpacity='0.2' />
            <stop offset='100%' stopColor='#4fc9e6' stopOpacity='0' />
          </radialGradient>
        </defs>
        <rect width='1200' height='240' fill='url(#ob-water-base)' />
        <rect width='1200' height='240' fill='url(#ob-water-glow)' />
        <g className='ob-water-lines'>
          {Array.from({ length: 8 }, (_, i) => {
            const y = 24 + i * 22;
            return (
              <path
                key={i}
                d={`M-40 ${y} C 120 ${y - 16} 220 ${y + 18} 360 ${y} S 600 ${
                  y - 16
                } 740 ${y} S 980 ${y + 18} 1240 ${y}`}
                fill='none'
                stroke='#4fc9e6'
                strokeWidth={i % 3 === 0 ? 1.4 : 0.9}
                strokeLinecap='round'
                opacity={0.16 - i * 0.012}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function ShoreBand() {
  return (
    <div className='y-optical-band ob-shore' aria-hidden='true'>
      <svg viewBox='0 0 1200 240' preserveAspectRatio='none' focusable='false'>
        <defs>
          <linearGradient id='ob-shore-base' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' stopColor='#2a2318' stopOpacity='0.48' />
            <stop offset='60%' stopColor='#141a20' stopOpacity='0.18' />
            <stop offset='100%' stopColor='#071224' stopOpacity='0' />
          </linearGradient>
          <radialGradient id='ob-shore-sun' cx='82%' cy='18%' r='54%'>
            <stop offset='0%' stopColor='#e2aa2e' stopOpacity='0.2' />
            <stop offset='100%' stopColor='#e2aa2e' stopOpacity='0' />
          </radialGradient>
        </defs>
        <rect width='1200' height='240' fill='url(#ob-shore-base)' />
        <rect width='1200' height='240' fill='url(#ob-shore-sun)' />
        <line
          x1='0'
          y1='150'
          x2='1200'
          y2='150'
          stroke='#d8bf8c'
          strokeWidth='1'
          opacity='0.3'
        />
        <g className='ob-ripples'>
          {[176, 196, 216, 234].map((y, i) => (
            <path
              key={y}
              d={`M-40 ${y} C 140 ${y - 7} 260 ${y + 7} 420 ${y} S 700 ${
                y - 7
              } 860 ${y} S 1080 ${y + 7} 1240 ${y}`}
              fill='none'
              stroke='#d8bf8c'
              strokeWidth='1'
              opacity={0.2 - i * 0.03}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

function GlassBand() {
  return (
    <div className='y-optical-band ob-glass' aria-hidden='true'>
      <svg viewBox='0 0 1200 240' preserveAspectRatio='none' focusable='false'>
        <defs>
          <linearGradient id='ob-glass-light' x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' stopColor='#ffd27a' stopOpacity='0' />
            <stop offset='52%' stopColor='#ffd27a' stopOpacity='0.22' />
            <stop offset='100%' stopColor='#ffd27a' stopOpacity='0' />
          </linearGradient>
        </defs>
        <g opacity='0.16' stroke='rgba(8,8,6,0.65)' strokeWidth='1.4'>
          <polygon points='0,0 190,0 220,86 118,142 0,112' fill='#d64923' />
          <polygon points='190,0 390,0 350,78 220,86' fill='#e2aa2e' />
          <polygon points='390,0 610,0 560,92 350,78' fill='#355240' />
          <polygon points='610,0 820,0 860,84 560,92' fill='#54a0b7' />
          <polygon points='820,0 1010,0 980,96 860,84' fill='#6b4a8a' />
          <polygon points='1010,0 1200,0 1200,108 980,96' fill='#c2703d' />
          <polygon points='0,112 118,142 96,240 0,240' fill='#355240' />
          <polygon points='118,142 220,86 350,78 318,240 96,240' fill='#d64923' />
          <polygon points='350,78 560,92 540,240 318,240' fill='#e2aa2e' />
          <polygon points='560,92 860,84 840,240 540,240' fill='#54a0b7' />
          <polygon points='860,84 980,96 1200,108 1200,240 840,240' fill='#355240' />
        </g>
        <line
          x1='0'
          y1='150'
          x2='1200'
          y2='150'
          stroke='rgba(8,8,6,0.7)'
          strokeWidth='2'
        />
        <rect
          className='ob-glass-sweep'
          x='-260'
          y='0'
          width='260'
          height='240'
          fill='url(#ob-glass-light)'
        />
      </svg>
    </div>
  );
}

function LoopBand() {
  return (
    <div className='y-optical-band ob-loop' aria-hidden='true'>
      <svg viewBox='0 0 1200 240' preserveAspectRatio='none' focusable='false'>
        <defs>
          <radialGradient id='ob-loop-glow' cx='76%' cy='26%' r='58%'>
            <stop offset='0%' stopColor='#e2aa2e' stopOpacity='0.16' />
            <stop offset='100%' stopColor='#e2aa2e' stopOpacity='0' />
          </radialGradient>
        </defs>
        <rect width='1200' height='240' fill='url(#ob-loop-glow)' />
        <g
          className='ob-loop-rings'
          fill='none'
          stroke='#e2aa2e'
          strokeWidth='1'
          opacity='0.14'
        >
          {[48, 84, 120, 156, 192].map((r, i) => (
            <circle
              key={r}
              cx='900'
              cy='84'
              r={r}
              strokeDasharray={i % 2 ? '3 7' : undefined}
            />
          ))}
        </g>
        <line
          x1='0'
          y1='164'
          x2='1200'
          y2='164'
          stroke='#e2aa2e'
          strokeWidth='1'
          opacity='0.24'
        />
      </svg>
    </div>
  );
}
