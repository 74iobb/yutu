import { useEffect, useState } from 'react';
import {
  Coil,
  EL,
  Fuse,
  NodeDot,
  PhaseDot,
  VContact,
  Wire,
} from './symbols';

const DELAY_MS = 3000;

type Stage = 'off' | 'y' | 'delta';

const STAGE_TEXT: Record<Stage, string> = {
  off: '待机',
  y: 'Y 形降压启动',
  delta: '△ 全压运行',
};

function MainCircuit({ stage, kt }: { stage: Stage; kt: number }) {
  const on = stage !== 'off';
  const live = stage === 'delta' ? EL.cyan : EL.amber;
  const phases = [60, 130, 200];
  return (
    <svg
      className='elab-svg is-main'
      viewBox='0 0 300 520'
      role='img'
      aria-label='Y-△ 降压启动主电路示意'
    >
      <text x={150} y={14} textAnchor='middle' fontSize={9} fill={EL.muted}>
        三相电源 → 主电路
      </text>
      {phases.map((x, i) => (
        <PhaseDot key={x} x={x} y={34} label={`L${i + 1}`} />
      ))}
      {phases.map(x => (
        <Wire key={`w1-${x}`} d={`M ${x} 38 L ${x} 70`} live={on} color={live} />
      ))}

      {/* QF 三极隔离开关（合闸状态） */}
      {phases.map(x => (
        <g key={`qf-${x}`}>
          <line x1={x} y1={70} x2={x} y2={76} stroke={EL.wire} strokeWidth={2} />
          <line
            x1={x}
            y1={76}
            x2={x + 2}
            y2={92}
            stroke={on ? live : EL.wire}
            strokeWidth={2.4}
            strokeLinecap='round'
          />
          <circle cx={x} cy={92} r={2.2} fill={on ? live : EL.wire} />
          <line x1={x} y1={92} x2={x} y2={100} stroke={EL.wire} strokeWidth={2} />
        </g>
      ))}
      <line
        x1={60}
        y1={84}
        x2={200}
        y2={84}
        stroke={EL.muted}
        strokeWidth={1.2}
        strokeDasharray='4 4'
      />
      <text x={210} y={88} fontSize={10.5} fill={EL.muted}>
        QF
      </text>

      {phases.map(x => (
        <Wire key={`w2-${x}`} d={`M ${x} 100 L ${x} 126`} live={on} color={live} />
      ))}
      {phases.map(x => (
        <Fuse key={`fu-${x}`} x={x} y={126} h={26} />
      ))}
      <text x={210} y={142} fontSize={10.5} fill={EL.muted}>
        FU1
      </text>

      {phases.map(x => (
        <Wire key={`w3-${x}`} d={`M ${x} 152 L ${x} 210`} live={on} color={live} />
      ))}
      {phases.map(x => (
        <rect
          key={`fr-${x}`}
          x={x - 5}
          y={210}
          width={10}
          height={32}
          rx={2}
          fill='rgba(12,24,46,.85)'
          stroke={EL.wire}
          strokeWidth={1.6}
        />
      ))}
      <text x={210} y={228} fontSize={10.5} fill={EL.muted}>
        FR 热元件
      </text>
      {phases.map(x => (
        <Wire key={`w4-${x}`} d={`M ${x} 242 L ${x} 300`} live={on} color={live} />
      ))}

      {/* 电机：六端子 */}
      <rect
        x={25}
        y={300}
        width={230}
        height={100}
        rx={10}
        fill='rgba(10,20,38,.86)'
        stroke={on ? live : EL.wire}
        strokeWidth={2}
      />
      {phases.map((x, i) => (
        <g key={`term-${x}`}>
          <circle cx={x} cy={300} r={3.2} fill={on ? live : EL.wire} />
          <text x={x + 7} y={294} fontSize={9.5} fill={EL.muted}>
            {['U1', 'V1', 'W1'][i]}
          </text>
          <circle cx={x} cy={400} r={3.2} fill={on ? live : EL.wire} />
          <text x={x + 7} y={416} fontSize={9.5} fill={EL.muted}>
            {['W2', 'U2', 'V2'][i]}
          </text>
        </g>
      ))}
      <g
        className={on ? 'elab-rotor is-spin' : 'elab-rotor'}
        style={{ transformOrigin: '130px 350px' }}
      >
        <circle
          cx={130}
          cy={350}
          r={22}
          fill='none'
          stroke={on ? live : EL.wire}
          strokeWidth={1.8}
        />
        <line
          x1={130}
          y1={333}
          x2={130}
          y2={367}
          stroke={on ? live : EL.wire}
          strokeWidth={2}
        />
        <line
          x1={113}
          y1={350}
          x2={147}
          y2={350}
          stroke={on ? live : EL.wire}
          strokeWidth={1.2}
          opacity={0.55}
        />
        <circle cx={130} cy={350} r={3} fill={on ? live : EL.wire} />
      </g>
      <text x={160} y={342} fontSize={10} fill={EL.muted}>
        M
      </text>
      <text x={160} y={356} fontSize={10} fill={EL.muted}>
        3~
      </text>
      <text
        x={160}
        y={374}
        fontSize={10.5}
        fontWeight={700}
        fill={on ? live : EL.muted}
      >
        {stage === 'delta' ? '△' : stage === 'y' ? 'Y' : '—'}
      </text>

      {phases.map(x => (
        <g key={`w5-${x}`}>
          <Wire d={`M ${x} 400 L ${x} 430`} live={on} color={live} />
          <circle cx={x} cy={430} r={2.6} fill={on ? live : EL.wire} />
        </g>
      ))}
      <rect
        x={20}
        y={444}
        width={260}
        height={48}
        rx={7}
        fill='rgba(12,24,46,.72)'
        stroke={on ? live : EL.wire}
        strokeWidth={1.2}
        strokeDasharray='4 4'
        opacity={0.9}
      />
      <text
        x={150}
        y={462}
        textAnchor='middle'
        fontSize={9.5}
        fontWeight={700}
        fill={on ? live : EL.ink}
      >
        三只尾端经 KM1 / KM2 切换接法
      </text>
      <text x={150} y={478} textAnchor='middle' fontSize={8.8} fill={EL.muted}>
        KM1 → 星点（Y） · KM2 → 首尾闭合（△）
      </text>

      <text x={150} y={508} textAnchor='middle' fontSize={9.5} fill={EL.muted}>
        {stage === 'off'
          ? '控制电路待命 · 电机停转'
          : stage === 'y'
            ? `Y 启动中 · KT 已计时 ${(kt / 1000).toFixed(1)} s`
            : '△ 全压运行 · 启动完成'}
      </text>
    </svg>
  );
}

function WindingGlyph({ mode, on }: { mode: 'Y' | 'D'; on: boolean }) {
  if (mode === 'Y') {
    const c = on ? EL.amber : EL.dim;
    return (
      <svg viewBox='0 0 140 108' className='elab-winding-svg' aria-hidden='true'>
        <line x1={26} y1={22} x2={66} y2={54} stroke={c} strokeWidth={3} />
        <line x1={114} y1={22} x2={74} y2={54} stroke={c} strokeWidth={3} />
        <line x1={70} y1={58} x2={70} y2={94} stroke={c} strokeWidth={3} />
        <rect
          x={36}
          y={29}
          width={22}
          height={13}
          rx={2}
          transform='rotate(34 47 35)'
          fill='rgba(10,20,38,.9)'
          stroke={c}
          strokeWidth={1.4}
        />
        <rect
          x={82}
          y={29}
          width={22}
          height={13}
          rx={2}
          transform='rotate(-34 93 35)'
          fill='rgba(10,20,38,.9)'
          stroke={c}
          strokeWidth={1.4}
        />
        <rect
          x={62}
          y={68}
          width={16}
          height={16}
          rx={2}
          fill='rgba(10,20,38,.9)'
          stroke={c}
          strokeWidth={1.4}
        />
        <circle cx={70} cy={55} r={5} fill={on ? EL.amber : EL.wire} />
        <text x={16} y={16} fontSize={9} fill={EL.muted}>
          U1
        </text>
        <text x={116} y={16} fontSize={9} fill={EL.muted}>
          V1
        </text>
        <text x={76} y={102} fontSize={9} fill={EL.muted}>
          W1
        </text>
        <text x={78} y={58} fontSize={8.5} fill={EL.muted}>
          星点
        </text>
      </svg>
    );
  }
  const c = on ? EL.cyan : EL.dim;
  return (
    <svg viewBox='0 0 140 108' className='elab-winding-svg' aria-hidden='true'>
      <line x1={26} y1={86} x2={114} y2={86} stroke={c} strokeWidth={3} />
      <line x1={26} y1={86} x2={70} y2={24} stroke={c} strokeWidth={3} />
      <line x1={114} y1={86} x2={70} y2={24} stroke={c} strokeWidth={3} />
      <rect
        x={61}
        y={16}
        width={18}
        height={14}
        rx={2}
        fill='rgba(10,20,38,.9)'
        stroke={c}
        strokeWidth={1.4}
      />
      <rect
        x={31}
        y={79}
        width={18}
        height={14}
        rx={2}
        fill='rgba(10,20,38,.9)'
        stroke={c}
        strokeWidth={1.4}
      />
      <rect
        x={91}
        y={79}
        width={18}
        height={14}
        rx={2}
        fill='rgba(10,20,38,.9)'
        stroke={c}
        strokeWidth={1.4}
      />
      <circle cx={70} cy={24} r={3.5} fill={on ? EL.cyan : EL.wire} />
      <circle cx={26} cy={86} r={3.5} fill={on ? EL.cyan : EL.wire} />
      <circle cx={114} cy={86} r={3.5} fill={on ? EL.cyan : EL.wire} />
      <text x={62} y={52} fontSize={13} fontWeight={700} fill={c}>
        △
      </text>
      <text x={2} y={104} fontSize={9} fill={EL.muted}>
        首尾相接
      </text>
    </svg>
  );
}

function ControlCircuit({ stage }: { stage: Stage }) {
  const liveY = stage === 'y';
  const liveD = stage === 'delta';
  const powered = stage !== 'off';
  const live = liveD ? EL.cyan : EL.amber;
  return (
    <svg
      className='elab-svg is-control'
      viewBox='0 0 480 600'
      role='img'
      aria-label='Y-△ 降压启动控制电路'
    >
      <text x={64} y={14} fontSize={9} fill={EL.muted}>
        L（经 FU2）
      </text>
      <Fuse x={60} y={30} h={28} />
      <Wire d='M 60 58 L 60 80' live={powered} color={live} />
      <VContact
        x={60}
        y={80}
        h={46}
        kind='NC'
        closed
        live={powered}
        color={live}
        label='FR'
        sub='过载常闭'
        side='left'
      />
      <Wire d='M 60 126 L 60 150' live={powered} color={live} />
      <VContact
        x={60}
        y={150}
        h={46}
        kind='NC'
        closed
        live={powered}
        color={live}
        label='SB1'
        sub='停止'
        side='left'
      />
      <Wire d='M 60 196 L 60 220' live={powered} color={live} />

      {/* 节点 3 的分支母线 */}
      <Wire d='M 60 220 L 360 220' live={powered} color={live} />
      <NodeDot x={60} y={220} live={powered} />

      {/* SB2 启动 + KM1 自锁 */}
      <Wire d='M 95 220 L 95 240' live={powered} color={live} />
      <VContact
        x={95}
        y={240}
        h={55}
        kind='NO'
        button
        live={liveY}
        color={live}
        label='SB2'
        sub='启动'
        side='right'
      />
      <Wire d='M 95 295 L 95 330' />

      <Wire d='M 145 220 L 145 240' live={powered} color={live} />
      <VContact
        x={145}
        y={240}
        h={55}
        kind='NO'
        closed={liveY}
        live={liveY}
        color={live}
        label='KM1'
        sub='自锁'
        side='right'
      />
      <Wire d='M 145 295 L 145 330 L 60 330' live={liveY} color={live} />
      <Wire d='M 60 330 L 145 330' live={liveY} color={live} />
      <NodeDot x={60} y={330} live={liveY} />

      {/* KM2 常闭互锁 */}
      <VContact
        x={60}
        y={345}
        h={45}
        kind='NC'
        closed={!liveD}
        live={liveY}
        color={live}
        label='KM2'
        sub='Y/△ 互锁'
        side='left'
      />
      <Wire d='M 60 390 L 60 410' live={liveY} color={live} />
      <NodeDot x={60} y={410} live={liveY} />

      {/* 线圈：KM1、KT */}
      <Wire d='M 60 410 L 60 432' live={liveY} color={live} />
      <Coil
        x={60}
        y={456}
        label='KM1'
        sub='Y 接触器'
        on={liveY}
        color={live}
      />
      <Wire d='M 60 480 L 60 560' live={liveY} color={live} />

      <Wire d='M 60 410 L 160 410 L 160 432' live={liveY} color={live} />
      <Coil
        x={160}
        y={456}
        label='KT'
        sub='时间继电器'
        on={liveY}
        color={live}
      />
      <Wire d='M 160 480 L 160 560' live={liveY} color={live} />

      {/* KT 延时闭合触点 → 节点 6 */}
      <Wire d='M 60 330 L 300 330 L 300 350' live={liveY} color={live} />
      <VContact
        x={300}
        y={350}
        h={55}
        kind='KT'
        closed={false}
        live={liveY}
        color={live}
        label='KT'
        sub='延时闭合'
        side='right'
      />
      <Wire d='M 300 405 L 300 430 L 360 430' />

      {/* KM2 自锁与线圈 */}
      <Wire d='M 360 220 L 360 240' live={powered} color={live} />
      <VContact
        x={360}
        y={240}
        h={55}
        kind='NO'
        closed={liveD}
        live={liveD}
        color={EL.cyan}
        label='KM2'
        sub='自锁'
        side='right'
      />
      <Wire d='M 360 295 L 360 430' live={liveD} color={EL.cyan} />
      <NodeDot x={360} y={430} live={liveD} />
      <Wire d='M 360 430 L 360 432' live={liveD} color={EL.cyan} />
      <Coil
        x={360}
        y={456}
        label='KM2'
        sub='△ 接触器'
        on={liveD}
        color={EL.cyan}
      />
      <Wire d='M 360 480 L 360 560' live={liveD} color={EL.cyan} />

      {/* 底部 0 号线 */}
      <Wire d='M 60 560 L 360 560' live={powered} color={live} />

      {/* 节点编号 */}
      {[
        [52, 66, '1'],
        [52, 140, '2'],
        [52, 212, '3'],
        [52, 322, '4'],
        [52, 402, '5'],
        [352, 422, '6'],
        [52, 552, '0'],
      ].map(([x, y, t]) => (
        <text key={t} x={x} y={y} fontSize={9} fill={EL.muted}>
          {t}
        </text>
      ))}

      <text x={240} y={586} textAnchor='middle' fontSize={9.5} fill={EL.muted}>
        控制电路 · 节点编号与教材图一致
      </text>
    </svg>
  );
}

export default function YStarDeltaLab({ photo }: { photo: string }) {
  const [stage, setStage] = useState<Stage>('off');
  const [kt, setKt] = useState(0);

  useEffect(() => {
    if (stage !== 'y') {
      setKt(0);
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - start;
      if (elapsed >= DELAY_MS) {
        setKt(DELAY_MS);
        setStage('delta');
      } else {
        setKt(elapsed);
      }
    }, 70);
    return () => window.clearInterval(id);
  }, [stage]);

  const start = () => {
    if (stage === 'off') setStage('y');
  };
  const stop = () => setStage('off');
  const skip = () => {
    if (stage === 'y') {
      setKt(DELAY_MS);
      setStage('delta');
    }
  };

  const pct = Math.min(100, (kt / DELAY_MS) * 100);
  const onKM1 = stage === 'y';
  const onKT = stage === 'y';
  const onKM2 = stage === 'delta';

  const steps: { t: string; d: string; active: boolean }[] = [
    {
      t: '待机：合上 QF、FU1、FU2',
      d: '控制电路得电待命，KM1、KM2、KT 均未动作，电机停转。',
      active: stage === 'off',
    },
    {
      t: '按 SB2：KM1 + KT 得电，Y 形启动',
      d: 'KM1 主触点把定子三相绕组接成 Y 形，每相电压降为线电压的 1/√3；KM1 常开触点并联在 SB2 两端，松开按钮后自锁。',
      active: stage === 'y',
    },
    {
      t: 'Y / △ 互锁',
      d: 'KT 延时触点尚未闭合，KM2 不会得电；KM2 常闭触点又串在 KM1 回路中。两组接触器不可能同时闭合，避免电源短路。',
      active: stage === 'y',
    },
    {
      t: 'KT 延时到：切换 △ 运行',
      d: 'KT 延时闭合常开触点接通 KM2，KM2 常闭先断开 KM1 与 KT；KM2 常开自锁，电机转为 △ 全压运行。',
      active: stage === 'delta',
    },
    {
      t: '停止 / 保护',
      d: '按 SB1 或热继电器 FR 动作，控制回路断开，KM2 释放，电机停转；再次启动需重新按 SB2。',
      active: false,
    },
  ];

  return (
    <div className='elab-stack'>
      <section className='elab-card'>
        <div className='elab-card-head'>
          <div>
            <span className='elab-eyebrow'>题 1 · 分析工作原理</span>
            <h2>异步电动机 Y-△ 降压启动控制电路</h2>
          </div>
          <span className={`elab-stage is-${stage}`}>{STAGE_TEXT[stage]}</span>
        </div>
        <p className='elab-note'>
          主电路负责「把电送进电机」，控制电路负责「什么时候用 Y、什么时候切 △」。先按启动，再看 KT
          怎样把 KM1 换成 KM2。
        </p>

        <div className='elab-grid'>
          <div className='elab-subcard'>
            <div className='elab-subhead'>
              <h3>主电路</h3>
              <span>三相 380 V · 六端子电机 · 等效重绘</span>
            </div>
            <div className='elab-svg-wrap'>
              <MainCircuit stage={stage} kt={kt} />
            </div>
            <div className='elab-winding-pair'>
              <div className={`elab-winding ${onKM1 ? 'is-on is-y' : ''}`}>
                <WindingGlyph mode='Y' on={onKM1} />
                <div>
                  <b>KM1 · Y 形</b>
                  <span>三相尾端短接成星点</span>
                </div>
              </div>
              <div className={`elab-winding ${onKM2 ? 'is-on is-d' : ''}`}>
                <WindingGlyph mode='D' on={onKM2} />
                <div>
                  <b>KM2 · △ 形</b>
                  <span>首尾相接成三角形</span>
                </div>
              </div>
            </div>
          </div>

          <div className='elab-subcard'>
            <div className='elab-subhead'>
              <h3>控制电路</h3>
              <span>图 1-39 · 节点 1–6 / 0</span>
            </div>
            <div className='elab-svg-wrap'>
              <ControlCircuit stage={stage} />
            </div>
            <div className='elab-legend'>
              <span>
                <i className='is-amber' />
                得电 / 闭合
              </span>
              <span>
                <i className='is-wire' />
                失电 / 断开
              </span>
              <span>
                <i className='is-cyan' />
                △ 运行回路
              </span>
            </div>
          </div>
        </div>

        <div className='elab-control-row'>
          <button
            type='button'
            className='elab-btn is-primary'
            onClick={start}
            disabled={stage !== 'off'}
          >
            合闸并启动 <em>SB2</em>
          </button>
          <button
            type='button'
            className='elab-btn is-amber'
            onClick={skip}
            disabled={stage !== 'y'}
          >
            跳过 KT 延时
          </button>
          <button
            type='button'
            className='elab-btn is-ghost'
            onClick={stop}
            disabled={stage === 'off'}
          >
            停止 <em>SB1</em>
          </button>
          <div className='elab-timer'>
            <div className='elab-timer-head'>
              <span>KT 延时</span>
              <b>
                {stage === 'y'
                  ? (kt / 1000).toFixed(1)
                  : stage === 'delta'
                    ? '3.0'
                    : '0.0'}{' '}
                / 3.0 s
              </b>
            </div>
            <div className='elab-bar'>
              <i
                style={{ width: `${stage === 'delta' ? 100 : pct}%` }}
                className={stage === 'delta' ? 'is-done' : ''}
              />
            </div>
            <small>演示压缩为 3 s；实际按电机启动时间整定。</small>
          </div>
        </div>

        <div className='elab-status-grid'>
          <StatusItem label='KM1' sub='Y 接触器' on={onKM1} />
          <StatusItem label='KT' sub='时间继电器' on={onKT} color='green' />
          <StatusItem label='KM2' sub='△ 接触器' on={onKM2} color='cyan' />
          <div
            className={`elab-status-item is-mode ${
              stage === 'delta'
                ? 'is-cyan'
                : stage === 'y'
                  ? 'is-amber'
                  : ''
            } ${stage !== 'off' ? 'is-on' : ''}`}
          >
            <b>{stage === 'y' ? 'Y' : stage === 'delta' ? '△' : '—'}</b>
            <span>定子接法</span>
          </div>
        </div>
      </section>

      <div className='elab-grid is-wide'>
        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>工作过程</h3>
            <span>按顺序看电流走向</span>
          </div>
          <ol className='elab-steps'>
            {steps.map((s, i) => (
              <li key={s.t} className={s.active ? 'is-active' : ''}>
                <i>{i + 1}</i>
                <div>
                  <b>{s.t}</b>
                  <p>{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>保护环节与特点</h3>
            <span>这张图的考点都在这</span>
          </div>
          <div className='elab-protect'>
            <div>
              <b>短路保护</b>
              <p>FU1 保护主电路，FU2 保护控制电路；熔体按额定电流选择。</p>
            </div>
            <div>
              <b>过载保护</b>
              <p>FR 热继电器的热元件串在主电路，常闭触点串在控制回路，过载时切断 KM1 / KM2。</p>
            </div>
            <div>
              <b>失压 / 欠压保护</b>
              <p>KM1、KM2 均靠自身常开触点自锁；电源中断后自动释放，恢复供电不会自行启动。</p>
            </div>
            <div>
              <b>Y / △ 互锁</b>
              <p>KM2 常闭触点串在 KM1 回路中，保证两组接触器不能同时闭合。</p>
            </div>
            <div>
              <b>启动电流</b>
              <p>Y 形时绕组相电压为 △ 形的 1/√3，线电流与启动转矩均降为 △ 形的 1/3。</p>
            </div>
            <div>
              <b>适用条件</b>
              <p>电机额定运行必须为 △ 接法，且启动时应为空载或轻载；切换瞬间有电流冲击。</p>
            </div>
          </div>
          <div className='elab-takeaway'>
            <b>一句话原理</b>
            <p>
              KM1 先把绕组接成 Y 降压启动，KT 计时到后让 KM2 接手并把绕组切成 △；KM2
              的常闭触点同时踢掉 KM1，完成「先断后合」的切换。
            </p>
          </div>
        </section>
      </div>

      <details className='elab-source'>
        <summary>对照教材原题图（图 1-39 题 1 图）</summary>
        <img src={photo} alt='教材原图：异步电动机 Y-△ 降压启动控制电路' />
      </details>
    </div>
  );
}

function StatusItem({
  label,
  sub,
  on,
  color = 'amber',
}: {
  label: string;
  sub: string;
  on: boolean;
  color?: 'amber' | 'cyan' | 'green';
}) {
  return (
    <div
      className={`elab-status-item is-${color} ${on ? 'is-on' : ''}`}
    >
      <span className={`elab-dot ${on ? 'is-on' : ''}`} />
      <b>{label}</b>
      <span>{sub}</span>
      <em>{on ? '得电' : '失电'}</em>
    </div>
  );
}
