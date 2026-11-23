import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Coil,
  EL,
  Fuse,
  NodeDot,
  PhaseDot,
  VContact,
  Wire,
} from './symbols';

const POS_MAX = 100;
const DWELL_MS = 6000;
const TICK = 60;

type Mode = 'idle' | 'forward' | 'reverse' | 'dwell' | 'stopped';

const MODE_TEXT: Record<Mode, string> = {
  idle: '原位待机',
  forward: '前进中',
  reverse: '后退中',
  dwell: '终端停留',
  stopped: '已停止',
};

const MODE_HINT: Record<Mode, string> = {
  idle: '按「前进」从原位出发',
  forward: 'KM1 得电，碰到 SQ2 自动停止',
  reverse: 'KM2 得电，碰到 SQ1 自动停止',
  dwell: 'SQ2 已动作，KT 正在计时',
  stopped: '公共回路断开，可在任意位置重新启动',
};

function cartX(pos: number) {
  return 120 + (pos / POS_MAX) * 660;
}

function CartScene({
  pos,
  mode,
  dwellLeft,
}: {
  pos: number;
  mode: Mode;
  dwellLeft: number;
}) {
  const x = cartX(pos);
  const moving = mode === 'forward' || mode === 'reverse';
  const sq1 = pos <= 1;
  const sq2 = pos >= 99;
  const dwellPct = 100 - (dwellLeft / DWELL_MS) * 100;
  const accent =
    mode === 'forward'
      ? EL.amber
      : mode === 'reverse'
        ? EL.cyan
        : mode === 'dwell'
          ? EL.green
          : EL.wire;
  return (
    <svg
      className='elab-svg elab-scene'
      viewBox='0 0 900 230'
      role='img'
      aria-label='小车在轨道上的运行示意'
    >
      <defs>
        <linearGradient id='elab-rail' x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0' stopColor='rgba(111,227,208,.15)' />
          <stop offset='.5' stopColor='rgba(111,227,208,.4)' />
          <stop offset='1' stopColor='rgba(111,227,208,.15)' />
        </linearGradient>
      </defs>

      {/* 原位 / 终端区域 */}
      <rect
        x={58}
        y={96}
        width={124}
        height={78}
        rx={8}
        fill={sq1 ? 'rgba(255,200,87,.08)' : 'rgba(111,134,164,.05)'}
        stroke={sq1 ? EL.amber : 'rgba(111,134,164,.35)'}
        strokeDasharray='5 5'
      />
      <text
        x={120}
        y={190}
        textAnchor='middle'
        fontSize={11}
        fontWeight={700}
        fill={sq1 ? EL.amber : EL.muted}
      >
        原位（SQ1）
      </text>

      <rect
        x={718}
        y={96}
        width={124}
        height={78}
        rx={8}
        fill={sq2 ? 'rgba(143,224,168,.08)' : 'rgba(111,134,164,.05)'}
        stroke={sq2 ? EL.green : 'rgba(111,134,164,.35)'}
        strokeDasharray='5 5'
      />
      <text
        x={780}
        y={190}
        textAnchor='middle'
        fontSize={11}
        fontWeight={700}
        fill={sq2 ? EL.green : EL.muted}
      >
        前进终端（SQ2）
      </text>

      {/* 轨道 */}
      <line
        x1={58}
        y1={150}
        x2={842}
        y2={150}
        stroke='url(#elab-rail)'
        strokeWidth={4}
      />
      {Array.from({ length: 20 }, (_, i) => 70 + i * 40).map(tx => (
        <line
          key={tx}
          x1={tx}
          y1={152}
          x2={tx - 8}
          y2={168}
          stroke='rgba(111,134,164,.35)'
          strokeWidth={2}
        />
      ))}

      {/* 极限保护标记 */}
      <g opacity={0.8}>
        <line x1={66} y1={130} x2={66} y2={150} stroke={EL.red} strokeWidth={1.5} />
        <text x={66} y={88} textAnchor='middle' fontSize={8.5} fill={EL.red}>
          SQ4
        </text>
        <line x1={834} y1={130} x2={834} y2={150} stroke={EL.red} strokeWidth={1.5} />
        <text x={834} y={88} textAnchor='middle' fontSize={8.5} fill={EL.red}>
          SQ3
        </text>
      </g>

      {/* 行程开关拨杆 */}
      <g>
        <line
          x1={120}
          y1={150}
          x2={120}
          y2={132}
          stroke={sq1 ? EL.amber : EL.wire}
          strokeWidth={2}
        />
        <circle
          cx={120}
          cy={129}
          r={4}
          fill={sq1 ? EL.amber : 'rgba(12,24,46,.9)'}
          stroke={sq1 ? EL.amber : EL.wire}
          strokeWidth={1.5}
        />
        <line
          x1={780}
          y1={150}
          x2={780}
          y2={132}
          stroke={sq2 ? EL.green : EL.wire}
          strokeWidth={2}
        />
        <circle
          cx={780}
          cy={129}
          r={4}
          fill={sq2 ? EL.green : 'rgba(12,24,46,.9)'}
          stroke={sq2 ? EL.green : EL.wire}
          strokeWidth={1.5}
        />
      </g>

      {/* 运行方向提示 */}
      <text x={420} y={214} textAnchor='middle' fontSize={9.5} fill={EL.muted}>
        前进 → · 后退 ←
      </text>

      {/* 小车 */}
      <g
        transform={`translate(${x - 48}, 98)`}
        style={{
          transition: moving ? 'transform 70ms linear' : 'transform 200ms ease',
        }}
      >
        {moving ? (
          <g opacity={0.7}>
            {[0, 1, 2].map(i => (
              <line
                key={i}
                x1={mode === 'forward' ? -14 - i * 10 : 110 + i * 10}
                y1={18 + i * 6}
                x2={mode === 'forward' ? -4 - i * 10 : 100 + i * 10}
                y2={18 + i * 6}
                stroke={accent}
                strokeWidth={1.6}
                strokeLinecap='round'
              />
            ))}
          </g>
        ) : null}
        <rect
          x={0}
          y={6}
          width={96}
          height={38}
          rx={8}
          fill='rgba(14,28,52,.96)'
          stroke={accent}
          strokeWidth={2.2}
        />
        <rect
          x={10}
          y={14}
          width={30}
          height={18}
          rx={3}
          fill='rgba(111,227,208,.12)'
          stroke='rgba(111,227,208,.35)'
          strokeWidth={1}
        />
        <text
          x={68}
          y={29}
          textAnchor='middle'
          fontSize={11}
          fontWeight={700}
          fill={EL.ink}
        >
          小车
        </text>
        <text
          x={68}
          y={40}
          textAnchor='middle'
          fontSize={8}
          fill={EL.muted}
        >
          {mode === 'forward'
            ? 'KM1 · 正转'
            : mode === 'reverse'
              ? 'KM2 · 反转'
              : mode === 'dwell'
                ? '等待 2 min'
                : '停止'}
        </text>
        {[22, 74].map(cx => (
          <g
            key={cx}
            className={moving ? 'elab-wheel is-spin' : 'elab-wheel'}
            style={{ transformOrigin: `${cx}px 48px` }}
          >
            <circle
              cx={cx}
              cy={48}
              r={8}
              fill='rgba(8,16,32,.95)'
              stroke={accent}
              strokeWidth={1.8}
            />
            <line
              x1={cx - 5}
              y1={48}
              x2={cx + 5}
              y2={48}
              stroke={accent}
              strokeWidth={1.2}
            />
          </g>
        ))}
      </g>

      {/* 终端停留气泡 */}
      {mode === 'dwell' ? (
        <g>
          <rect
            x={640}
            y={30}
            width={210}
            height={62}
            rx={10}
            fill='rgba(12,24,46,.95)'
            stroke={EL.green}
            strokeWidth={1.6}
          />
          <text x={658} y={50} fontSize={10} fontWeight={700} fill={EL.green}>
            终端停留 2 min（演示 6 s）
          </text>
          <rect
            x={658}
            y={62}
            width={174}
            height={8}
            rx={4}
            fill='rgba(143,224,168,.14)'
          />
          <rect
            x={658}
            y={62}
            width={(174 * dwellPct) / 100}
            height={8}
            rx={4}
            fill={EL.green}
          />
          <text x={658} y={83} fontSize={9} fill={EL.muted}>
            剩余 {(dwellLeft / 1000).toFixed(1)} s → 自动返回
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function MainCircuit({ mode }: { mode: Mode }) {
  const moving = mode === 'forward' || mode === 'reverse';
  const km1 = mode === 'forward';
  const km2 = mode === 'reverse';
  const phases = [60, 130, 200];
  return (
    <svg
      className='elab-svg is-main'
      viewBox='0 0 440 470'
      role='img'
      aria-label='小车正反转主电路'
    >
      {phases.map((x, i) => (
        <PhaseDot key={x} x={x} y={24} label={`L${i + 1}`} />
      ))}
      {phases.map(x => (
        <Wire key={`a-${x}`} d={`M ${x} 28 L ${x} 64`} />
      ))}
      {/* QF */}
      {phases.map(x => (
        <g key={`qf-${x}`}>
          <line x1={x} y1={64} x2={x} y2={70} stroke={EL.wire} strokeWidth={2} />
          <line
            x1={x}
            y1={70}
            x2={x + 2}
            y2={88}
            stroke={EL.wire}
            strokeWidth={2.4}
            strokeLinecap='round'
          />
          <circle cx={x} cy={88} r={2.2} fill={EL.wire} />
          <line x1={x} y1={88} x2={x} y2={94} stroke={EL.wire} strokeWidth={2} />
        </g>
      ))}
      <line
        x1={60}
        y1={79}
        x2={200}
        y2={79}
        stroke={EL.muted}
        strokeWidth={1.1}
        strokeDasharray='4 4'
      />
      <text x={210} y={82} fontSize={10} fill={EL.muted}>
        QF
      </text>
      {phases.map(x => (
        <Wire key={`b-${x}`} d={`M ${x} 94 L ${x} 120`} />
      ))}
      {phases.map(x => (
        <Fuse key={`fu-${x}`} x={x} y={120} h={24} />
      ))}
      <text x={210} y={134} fontSize={10} fill={EL.muted}>
        FU1
      </text>
      {phases.map(x => (
        <Wire key={`c-${x}`} d={`M ${x} 144 L ${x} 184`} />
      ))}

      {/* KM1 正转 */}
      {phases.map(x => (
        <VContact
          key={`km1-${x}`}
          x={x}
          y={184}
          h={32}
          kind='NO'
          closed={km1}
          live={km1}
          color={EL.amber}
        />
      ))}
      {phases.map(x => (
        <Wire
          key={`d-${x}`}
          d={`M ${x} 216 L ${x} 322`}
          live={km1}
          color={EL.amber}
        />
      ))}

      {/* KM2 反转：换相接入 */}
      <Wire d='M 60 152 L 270 152 L 270 184' live={km2} color={EL.cyan} />
      <Wire d='M 130 164 L 300 164 L 300 184' live={km2} color={EL.cyan} />
      <Wire d='M 200 176 L 330 176 L 330 184' live={km2} color={EL.cyan} />
      {[270, 300, 330].map(x => (
        <VContact
          key={`km2-${x}`}
          x={x}
          y={184}
          h={32}
          kind='NO'
          closed={km2}
          live={km2}
          color={EL.cyan}
        />
      ))}
      {/* 换相后的输出：L1→V，L2→U，L3→W */}
      <Wire
        d='M 270 216 L 270 240 L 130 240 L 130 322'
        live={km2}
        color={EL.cyan}
      />
      <Wire
        d='M 300 216 L 300 252 L 60 252 L 60 322'
        live={km2}
        color={EL.cyan}
      />
      <Wire
        d='M 330 216 L 330 264 L 200 264 L 200 322'
        live={km2}
        color={EL.cyan}
      />
      <text x={337} y={198} fontSize={9} fill={EL.muted}>
        KM2
      </text>
      <text x={337} y={210} fontSize={8.5} fill={EL.muted}>
        换相
      </text>
      <text x={16} y={198} fontSize={9} fill={EL.muted}>
        KM1
      </text>
      <text x={16} y={210} fontSize={8.5} fill={EL.muted}>
        正转
      </text>

      {phases.map((x, i) => (
        <text key={`bus-${x}`} x={x + 6} y={316} fontSize={9} fill={EL.muted}>
          {['U', 'V', 'W'][i]}
        </text>
      ))}
      {phases.map(x => (
        <rect
          key={`fr-${x}`}
          x={x - 4.5}
          y={322}
          width={9}
          height={26}
          rx={2}
          fill='rgba(12,24,46,.85)'
          stroke={EL.wire}
          strokeWidth={1.5}
        />
      ))}
      <text x={210} y={338} fontSize={9.5} fill={EL.muted}>
        FR
      </text>
      {phases.map(x => (
        <Wire
          key={`f-${x}`}
          d={`M ${x} 348 L ${x} 360`}
          live={moving}
          color={km2 ? EL.cyan : EL.amber}
        />
      ))}
      <circle
        cx={130}
        cy={396}
        r={36}
        fill='rgba(10,20,38,.9)'
        stroke={moving ? (km2 ? EL.cyan : EL.amber) : EL.wire}
        strokeWidth={2}
      />
      <g
        className={moving ? 'elab-rotor is-spin' : 'elab-rotor'}
        style={{ transformOrigin: '130px 396px' }}
      >
        <line
          x1={130}
          y1={378}
          x2={130}
          y2={414}
          stroke={moving ? (km2 ? EL.cyan : EL.amber) : EL.wire}
          strokeWidth={2}
        />
        <line
          x1={112}
          y1={396}
          x2={148}
          y2={396}
          stroke={moving ? (km2 ? EL.cyan : EL.amber) : EL.wire}
          strokeWidth={1.2}
          opacity={0.5}
        />
        <circle
          cx={130}
          cy={396}
          r={3.4}
          fill={moving ? (km2 ? EL.cyan : EL.amber) : EL.wire}
        />
      </g>
      <text x={130} y={452} textAnchor='middle' fontSize={9.5} fill={EL.muted}>
        M 3~ · {mode === 'forward' ? '正转' : mode === 'reverse' ? '反转' : '停转'}
      </text>
      <line x1={166} y1={396} x2={196} y2={396} stroke={EL.wire} strokeWidth={1.5} />
      <line x1={196} y1={388} x2={196} y2={404} stroke={EL.wire} strokeWidth={1.5} />
      <line x1={202} y1={392} x2={202} y2={400} stroke={EL.wire} strokeWidth={1.5} />
      <line x1={208} y1={395} x2={208} y2={397} stroke={EL.wire} strokeWidth={1.5} />
      <text x={214} y={400} fontSize={8.5} fill={EL.muted}>
        PE
      </text>
    </svg>
  );
}

function ControlCircuit({
  mode,
  pos,
  stopPulse,
}: {
  mode: Mode;
  pos: number;
  stopPulse: boolean;
}) {
  const powered = mode !== 'stopped';
  const km1 = mode === 'forward';
  const km2 = mode === 'reverse';
  const kt = mode === 'dwell';
  const sq2 = pos >= 99;
  const sq1 = pos <= 1;

  const live1 = km1;
  const live2 = km2;
  const live3 = kt;
  const topLive = powered;

  return (
    <svg
      className='elab-svg is-control'
      viewBox='0 0 780 610'
      role='img'
      aria-label='小车自动往返控制电路'
    >
      <text x={40} y={40} fontSize={9} fill={EL.muted}>
        L（经 FU2）
      </text>
      <Wire d='M 40 50 L 700 50' live={topLive} />

      {/* 公共停止链 */}
      <Wire d='M 80 50 L 80 80' live={topLive} />
      <VContact
        x={80}
        y={80}
        h={40}
        kind='NC'
        closed
        live={topLive}
        label='FR'
        sub='过载常闭'
        side='left'
      />
      <Wire d='M 80 120 L 80 145' live={topLive} />
      <VContact
        x={80}
        y={145}
        h={40}
        kind='NC'
        closed={!stopPulse}
        live={topLive && !stopPulse}
        label='SB1'
        sub='总停止'
        side='left'
      />
      <Wire d='M 80 185 L 80 205' live={topLive && !stopPulse} />
      <NodeDot x={80} y={205} live={topLive && !stopPulse} />
      <Wire d='M 80 205 L 650 205' live={topLive && !stopPulse} />
      <text x={84} y={222} fontSize={8.5} fill={EL.muted}>
        A
      </text>

      {/* 第一条：KM1 前进回路 */}
      <Wire d='M 190 205 L 190 215' live={live1} />
      <Wire d='M 190 215 L 245 215' live={live1} />
      <Wire d='M 245 275 L 190 275' live={live1} />
      <VContact
        x={190}
        y={215}
        h={60}
        kind='NO'
        button
        live={live1}
        label='SB2'
        sub='前进启动'
        side='left'
      />
      <VContact
        x={245}
        y={215}
        h={60}
        kind='NO'
        closed={km1}
        live={live1}
        label='KM1'
        sub='自锁'
        side='right'
      />
      <Wire d='M 190 275 L 190 295' live={live1} />
      <VContact
        x={190}
        y={295}
        h={45}
        kind='NC'
        closed={!sq2}
        live={live1}
        label='SQ2'
        sub='终端常闭'
        side='left'
      />
      <VContact
        x={190}
        y={355}
        h={45}
        kind='NC'
        closed
        live={live1}
        label='SQ3'
        sub='前进极限'
        side='left'
      />
      <VContact
        x={190}
        y={415}
        h={45}
        kind='NC'
        closed={!km2}
        live={live1}
        label='KM2'
        sub='互锁'
        side='left'
      />
      <Wire d='M 190 460 L 190 485' live={live1} />
      <Coil
        x={190}
        y={497}
        label='KM1'
        sub='前进'
        on={km1}
        color={EL.amber}
      />
      <Wire d='M 190 509 L 190 540' live={live1} />

      {/* 第二条：KM2 后退回路 */}
      <Wire d='M 430 205 L 430 215' live={live2} />
      <Wire d='M 430 215 L 550 215' live={live2} />
      <Wire d='M 550 275 L 430 275' live={live2} />
      <VContact
        x={430}
        y={215}
        h={60}
        kind='NO'
        button
        live={live2}
        label='SB3'
        sub='后退启动'
        side='left'
      />
      <VContact
        x={490}
        y={215}
        h={60}
        kind='NO'
        closed={km2}
        live={live2}
        label='KM2'
        sub='自锁'
        side='right'
      />
      <VContact
        x={550}
        y={215}
        h={60}
        kind='KT'
        closed={false}
        live={false}
        color={EL.green}
        label='KT'
        sub='延时闭合'
        side='right'
      />
      <Wire d='M 430 275 L 430 295' live={live2} />
      <VContact
        x={430}
        y={295}
        h={45}
        kind='NC'
        closed={!sq1}
        live={live2}
        label='SQ1'
        sub='原位常闭'
        side='left'
      />
      <VContact
        x={430}
        y={355}
        h={45}
        kind='NC'
        closed
        live={live2}
        label='SQ4'
        sub='后退极限'
        side='left'
      />
      <VContact
        x={430}
        y={415}
        h={45}
        kind='NC'
        closed={!km1}
        live={live2}
        label='KM1'
        sub='互锁'
        side='left'
      />
      <Wire d='M 430 460 L 430 485' live={live2} />
      <Coil
        x={430}
        y={497}
        label='KM2'
        sub='后退'
        on={km2}
        color={EL.cyan}
      />
      <Wire d='M 430 509 L 430 540' live={live2} />

      {/* 第三条：SQ2 常开 → KT 计时 */}
      <Wire d='M 650 205 L 650 215' live={live3} />
      <VContact
        x={650}
        y={215}
        h={60}
        kind='NO'
        closed={sq2}
        live={live3}
        color={EL.green}
        label='SQ2'
        sub='终端常开'
        side='left'
      />
      <Wire
        d='M 650 275 L 650 485'
        live={live3}
        color={EL.green}
      />
      <Coil
        x={650}
        y={497}
        label='KT'
        sub='2 min'
        on={kt}
        color={EL.green}
      />
      <Wire d='M 650 509 L 650 540' live={live3} color={EL.green} />

      {/* 底部 N 线 */}
      <Wire d='M 80 540 L 650 540' live={topLive} />
      <text x={656} y={544} fontSize={9} fill={EL.muted}>
        N
      </text>

      <text x={390} y={586} textAnchor='middle' fontSize={9.5} fill={EL.muted}>
        KM1/KM2 常闭互锁 · SQ3/SQ4 极限保护 · SB1 串在公共回路
      </text>
    </svg>
  );
}

export default function CartLab({ photo }: { photo: string }) {
  const [pos, setPos] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [dwellLeft, setDwellLeft] = useState(DWELL_MS);
  const [stopPulse, setStopPulse] = useState(false);
  const [logs, setLogs] = useState<
    { id: number; time: string; msg: string }[]
  >([]);

  const posRef = useRef(0);
  const dwellRef = useRef(DWELL_MS);
  const logSeq = useRef(1);
  const stopTimer = useRef<number | null>(null);

  const pushLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev =>
      [{ id: logSeq.current++, time, msg }, ...prev].slice(0, 5)
    );
  }, []);

  useEffect(() => {
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'forward' && mode !== 'reverse' && mode !== 'dwell') return;
    const id = window.setInterval(() => {
      if (mode === 'forward') {
        const next = Math.min(POS_MAX, posRef.current + 0.7);
        posRef.current = next;
        setPos(next);
        if (next >= POS_MAX) {
          setMode('dwell');
          dwellRef.current = DWELL_MS;
          setDwellLeft(DWELL_MS);
          pushLog('小车碰到 SQ2 → 前进停止，KT 开始 2 min 停留计时');
        }
      } else if (mode === 'reverse') {
        const next = Math.max(0, posRef.current - 0.85);
        posRef.current = next;
        setPos(next);
        if (next <= 0) {
          setMode('idle');
          pushLog('小车回到原位 → SQ1 动作，后退停止');
        }
      } else {
        const next = Math.max(0, dwellRef.current - TICK);
        dwellRef.current = next;
        setDwellLeft(next);
        if (next <= 0) {
          setMode('reverse');
          pushLog('KT 延时到 → KM2 得电，小车自动返回');
        }
      }
    }, TICK);
    return () => window.clearInterval(id);
  }, [mode, pushLog]);

  const forward = () => {
    // 与 KM2 常闭互锁一致：后退中必须先按 SB1 停止，才能换到前进
    if (mode === 'dwell' || mode === 'reverse' || posRef.current >= 99) return;
    setMode('forward');
    pushLog('按下 SB2 → KM1 得电并自锁，小车前进');
  };

  const backward = () => {
    // 与 KM1 常闭互锁一致：前进中必须先按 SB1 停止，才能换到后退
    if (mode === 'forward' || posRef.current <= 1) return;
    setMode('reverse');
    pushLog('按下 SB3 → KM2 得电并自锁，小车后退');
  };

  const stop = () => {
    setStopPulse(true);
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(() => setStopPulse(false), 700);
    if (mode === 'idle' && posRef.current <= 0) {
      pushLog('按下 SB1：小车已在原位');
      return;
    }
    setMode('stopped');
    pushLog('按下 SB1 → 公共回路断开，KM1/KM2 释放，小车停止');
  };

  const reset = () => {
    posRef.current = 0;
    dwellRef.current = DWELL_MS;
    setPos(0);
    setDwellLeft(DWELL_MS);
    setMode('idle');
    pushLog('复位：小车回到原位，SQ1 动作');
  };

  const km1 = mode === 'forward';
  const km2 = mode === 'reverse';
  const kt = mode === 'dwell';
  const sq1 = pos <= 1;
  const sq2 = pos >= 99;

  return (
    <div className='elab-stack'>
      <section className='elab-card'>
        <div className='elab-card-head'>
          <div>
            <span className='elab-eyebrow'>题 2 · 设计控制电路</span>
            <h2>小车自动往返：前进 → 停留 2 min → 自动返回</h2>
          </div>
          <span className={`elab-stage is-${mode}`}>{MODE_TEXT[mode]}</span>
        </div>
        <p className='elab-note'>
          三个要求对应三处关键接线：SQ2 常闭让小车在终端停下，SQ2 常开启动 KT 计时，SB1
          串在公共回路让小车在任意位置都能停；两个启动按钮各自自锁，停下后可按对应方向重新出发。
        </p>

        <div className='elab-svg-wrap'>
          <CartScene pos={pos} mode={mode} dwellLeft={dwellLeft} />
        </div>
        <p className='elab-scene-caption'>
          左端为原位（SQ1 / 后退极限 SQ4），右端为前进终端（SQ2 / 前进极限
          SQ3）；小车在两端之间往返。
        </p>

        <div className='elab-control-row'>
          <button
            type='button'
            className='elab-btn is-primary'
            onClick={forward}
            disabled={
              mode === 'dwell' ||
              mode === 'forward' ||
              mode === 'reverse' ||
              pos >= 99
            }
          >
            前进 <em>SB2</em>
          </button>
          <button
            type='button'
            className='elab-btn is-cyan'
            onClick={backward}
            disabled={mode === 'reverse' || mode === 'forward' || pos <= 1}
          >
            后退 <em>SB3</em>
          </button>
          <button
            type='button'
            className='elab-btn is-ghost'
            onClick={stop}
            disabled={mode === 'stopped' || (mode === 'idle' && pos <= 0)}
          >
            停止 <em>SB1</em>
          </button>
          <button type='button' className='elab-btn is-ghost' onClick={reset}>
            复位
          </button>
          <div className='elab-mini-status'>
            <span>位置 {Math.round(pos)}%</span>
            <span>
              {mode === 'dwell'
                ? `停留倒计时 ${(dwellLeft / 1000).toFixed(1)} s（演示）`
                : MODE_HINT[mode]}
            </span>
            {mode === 'forward' || mode === 'reverse' ? (
              <span className='elab-mini-tip'>换向前先按「停止」</span>
            ) : null}
          </div>
        </div>

        <div className='elab-status-grid is-five'>
          <StatusItem label='KM1' sub='正转' on={km1} />
          <StatusItem label='KM2' sub='反转' on={km2} color='cyan' />
          <StatusItem label='KT' sub='2 min 计时' on={kt} color='green' />
          <StatusItem label='SQ1' sub='原位' on={sq1} color='amber' />
          <StatusItem label='SQ2' sub='终端' on={sq2} color='green' />
        </div>

        <div className='elab-log'>
          <div className='elab-log-head'>
            <b>动作记录</b>
            <span>演示时间已按比例压缩</span>
          </div>
          {logs.length ? (
            <ul>
              {logs.map(item => (
                <li key={item.id}>
                  <i>{item.time}</i>
                  <span>{item.msg}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className='elab-log-empty'>
              按「前进」开始一次自动循环；也可以在途中按「停止」，再用「前进 / 后退」验证任意位置启停。
            </p>
          )}
        </div>
      </section>

      <div className='elab-grid is-wide'>
        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>控制电路（设计答案）</h3>
            <span>三条要求各自落在哪一段</span>
          </div>
          <div className='elab-svg-wrap'>
            <ControlCircuit mode={mode} pos={pos} stopPulse={stopPulse} />
          </div>
          <div className='elab-legend'>
            <span>
              <i className='is-amber' />
              前进回路得电
            </span>
            <span>
              <i className='is-cyan' />
              后退回路得电
            </span>
            <span>
              <i className='is-green' />
              KT 计时
            </span>
            <span>
              <i className='is-wire' />
              未得电
            </span>
          </div>
          <div className='elab-logic'>
            <b>继电器逻辑表达式</b>
            <pre>{`KM1 = (SB2 + KM1) · SQ2常闭 · SQ3 · KM2 · SB1 · FR
KM2 = (SB3 + KM2 + KT) · SQ1常闭 · SQ4 · KM1 · SB1 · FR
KT  = SQ2常开`}</pre>
            <p>
              <code>+</code> 表示并联（或），<code>·</code> 表示串联（与）；
              KM1/KM2 在对方回路中为互锁常闭触点。表达式中的 KT 指其延时闭合触点，与 SB3 并联。
            </p>
          </div>
        </section>

        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>设计要求 → 实现方式</h3>
            <span>对照题目三条</span>
          </div>
          <ol className='elab-req'>
            <li>
              <b>① 由原位开始前进，到终端自动停止</b>
              <p>
                SB2 与 KM1 常开触点并联后串入 KM1 线圈；KM1 通电后自锁。SQ2
                的常闭触点串在 KM1 回路，小车到达终端压住 SQ2，KM1 立即释放，前进停止。
                原位 SQ1 的常闭触点只串在 KM2 回路，所以原位仍可向前。
              </p>
            </li>
            <li>
              <b>② 终端停留 2 min 后自动返回原位停止</b>
              <p>
                SQ2 采用复合行程开关：到达终端后常闭断开（停前进），常开闭合（启动
                KT）。KT 整定 2 min，其延时闭合触点与 SB3 并联；2 min
                后自动接通 KM2，小车后退。回到原位压住 SQ1，其常闭触点断开 KM2，后退停止。
              </p>
            </li>
            <li>
              <b>③ 前进或后退途中任意位置都能停止或启动</b>
              <p>
                SB1 总停止串在两条回路的公共部分，按下即切断全部线圈。停止后 KM1/KM2
                自锁解除；由于此时未压住任何终端行程开关，按 SB2 可继续前进，按 SB3
                可反向后退。两个方向都设有自锁，松开按钮后仍保持运行。
              </p>
            </li>
          </ol>
          <div className='elab-takeaway'>
            <b>补充保护</b>
            <p>
              KM1 与 KM2 的常闭触点互相串入对方回路，防止正反转同时吸合造成相间短路；
              SQ3、SQ4 作为前进/后退极限保护，终端开关失灵时切断对应方向。FR
              热继电器提供长期过载保护，FU1/FU2 提供短路保护。
            </p>
          </div>
        </section>
      </div>

      <div className='elab-grid is-main-circuit'>
        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>主电路</h3>
            <span>KM1 正转 / KM2 换相反转</span>
          </div>
          <div className='elab-svg-wrap'>
            <MainCircuit mode={mode} />
          </div>
        </section>

        <section className='elab-card'>
          <div className='elab-subhead'>
            <h3>元件清单</h3>
            <span>低压电器与作用</span>
          </div>
          <div className='elab-table-wrap'>
            <table className='elab-table'>
              <thead>
                <tr>
                  <th>代号</th>
                  <th>名称</th>
                  <th>作用</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['QF', '断路器', '主电路电源开关，兼短路保护'],
                  ['FU1 / FU2', '熔断器', '主电路 / 控制电路短路保护'],
                  ['KM1 / KM2', '交流接触器', '正转 / 反转，带自锁与互锁'],
                  ['FR', '热继电器', '电动机长期过载保护'],
                  ['SB1', '停止按钮', '串在公共回路，任意位置停车'],
                  ['SB2 / SB3', '启动按钮', '前进 / 后退启动'],
                  ['SQ1', '原位行程开关', '原位停止后退，常闭'],
                  ['SQ2', '终端行程开关', '终端停止前进（常闭）+ 启动 KT（常开）'],
                  ['SQ3 / SQ4', '极限行程开关', '前进 / 后退极限保护'],
                  ['KT', '时间继电器', '终端停留 2 min 延时，延时闭合触点'],
                  ['M 3~', '三相异步电动机', '拖动小车前进 / 后退'],
                ].map(row => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <details className='elab-source'>
        <summary>对照教材原题图（题 2）</summary>
        <img src={photo} alt='教材原图：设计一个小车运行的控制电路' />
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
    <div className={`elab-status-item ${on ? 'is-on' : ''} is-${color}`}>
      <span className={`elab-dot ${on ? 'is-on' : ''}`} />
      <b>{label}</b>
      <span>{sub}</span>
      <em>{on ? '动作' : '复位'}</em>
    </div>
  );
}
