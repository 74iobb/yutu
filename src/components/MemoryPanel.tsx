import { useMemo, useState } from 'react';
import { retrieveMemories, type MemoryItem } from '@/lib/memory';
import { useYutu } from '@/store/YutuContext';
import { Empty } from './bits';
import GrowthRadar from './GrowthRadar';

const KIND_LABEL: Record<MemoryItem['kind'], string> = {
  victory: '归档',
  review: '复盘',
  discussion: '讨论',
};

const KIND_COLOR: Record<MemoryItem['kind'], string> = {
  victory: '#f0b25a',
  review: '#7ec8ff',
  discussion: '#b9a8ff',
};

const W = 720;
const H = 230;
const L = 46;
const R = 688;
const TOP = 30;
const BOTTOM = 184;

function timeOf(at: string) {
  const t = Date.parse(at.replace(' ', 'T'));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 「系统记得你」：本地长期记忆的时间线 + 选中记忆的七维雷达。
 *
 * - 横轴：时间（从最早到最近）
 * - 纵轴：与当前处境的七维相似度（0–100%）
 * - 点击任意记忆：查看原文，并把「当时的七维」和「现在」叠在一张雷达上
 *
 * 全部在本机计算，不上传。
 */
export default function MemoryPanel() {
  const { state, ownerKey } = useYutu();
  const memories = useMemo(
    () =>
      retrieveMemories(
        state.profile.s,
        state.victories,
        state.reviews,
        state.discussions ?? [],
        ownerKey,
        24
      ),
    [
      state.profile.s,
      state.victories,
      state.reviews,
      state.discussions,
      ownerKey,
    ]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    memories.find((m) => m.id === selectedId) ?? memories[0] ?? null;

  /* 时间轴按时间正序；记忆列表本身按相似度排序 */
  const timelineMemories = useMemo(
    () => [...memories].sort((a, b) => timeOf(a.at) - timeOf(b.at)),
    [memories]
  );

  const points = useMemo(() => {
    const times = timelineMemories.map((m) => timeOf(m.at));
    const min = Math.min(...times);
    const max = Math.max(...times);
    return timelineMemories.map((m, i) => {
      const x =
        timelineMemories.length <= 1
          ? (L + R) / 2
          : max === min
            ? L +
              ((R - L) * i) / Math.max(1, timelineMemories.length - 1)
            : L + ((times[i] - min) / (max - min)) * (R - L);
      const y = BOTTOM - Math.max(0, Math.min(1, m.sim)) * (BOTTOM - TOP);
      return { m, x, y };
    });
  }, [timelineMemories]);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return (
    <section className='y-card y-memory-panel' aria-label='系统记得你'>
      <h3>
        系统记得你
        <span className='y-mini'>本机向量检索 · 不上传</span>
      </h3>
      <p className='y-note' style={{ paddingBottom: 8 }}>
        横轴是时间，纵轴是「当时的处境与现在有多接近」。点任意一点，可以看当时的原文和七维对比。
      </p>

      {memories.length ? (
        <div className='y-memory-body'>
          <div className='y-memory-timeline'>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role='img'
              aria-label='历史记忆时间线与相似度'
            >
              {/* 纵向网格：0 / 50 / 100% */}
              {[0, 0.5, 1].map((v) => {
                const y = BOTTOM - v * (BOTTOM - TOP);
                return (
                  <g key={v}>
                    <line
                      x1={L}
                      y1={y}
                      x2={R}
                      y2={y}
                      className='y-mt-grid'
                    />
                    <text
                      x={L - 8}
                      y={y + 3.5}
                      textAnchor='end'
                      className='y-mt-tick'
                    >
                      {Math.round(v * 100)}%
                    </text>
                  </g>
                );
              })}

              {/* 时间连线 */}
              {points.length > 1 ? (
                <path d={line} className='y-mt-line' />
              ) : null}

              {/* 现在（100%） */}
              <g className='y-mt-now'>
                <line
                  x1={R + 12}
                  y1={TOP - 6}
                  x2={R + 12}
                  y2={BOTTOM}
                  className='y-mt-now-line'
                />
                <circle cx={R + 12} cy={TOP} r={4} />
                <text x={R + 12} y={TOP - 12} textAnchor='middle'>
                  现在
                </text>
              </g>

              {/* 记忆点 */}
              {points.map(({ m, x, y }) => {
                const active = selected?.id === m.id;
                return (
                  <g
                    key={m.id}
                    role='button'
                    tabIndex={0}
                    aria-label={`${KIND_LABEL[m.kind]} · ${m.when} · 接近度 ${Math.round(
                      m.sim * 100
                    )}%`}
                    onClick={() => setSelectedId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(m.id);
                      }
                    }}
                    className='y-mt-dot'
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 13 : 10}
                      className='y-mt-dot-halo'
                      style={{ fill: KIND_COLOR[m.kind] }}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 5.5 : 4}
                      className='y-mt-dot-core'
                      style={{ fill: KIND_COLOR[m.kind] }}
                    />
                    <title>
                      {`${KIND_LABEL[m.kind]} · ${m.when} · 接近度 ${Math.round(
                        m.sim * 100
                      )}%`}
                    </title>
                  </g>
                );
              })}

              {/* 首尾时间 */}
              {points.length ? (
                <>
                  <text
                    x={points[0].x}
                    y={BOTTOM + 20}
                    textAnchor='middle'
                    className='y-mt-date'
                  >
                    {timelineMemories[0].when}
                  </text>
                  {points.length > 1 ? (
                    <text
                      x={points[points.length - 1].x}
                      y={BOTTOM + 20}
                      textAnchor='middle'
                      className='y-mt-date'
                    >
                      {timelineMemories[timelineMemories.length - 1].when}
                    </text>
                  ) : null}
                </>
              ) : null}
            </svg>

            <div className='y-mt-legend'>
              {(['victory', 'review', 'discussion'] as const).map((k) => (
                <span key={k}>
                  <i style={{ background: KIND_COLOR[k] }} />
                  {KIND_LABEL[k]}
                </span>
              ))}
            </div>
          </div>

          {selected ? (
            <div className='y-memory-detail'>
              <div className='y-memory-detail-head'>
                <span>{KIND_LABEL[selected.kind]}</span>
                <span>{selected.when}</span>
                <b>接近度 {Math.round(selected.sim * 100)}%</b>
              </div>
              <p>{selected.full}</p>
              {selected.vector ? (
                <GrowthRadar
                  before={selected.vector}
                  after={state.profile.s}
                  beforeLabel='当时'
                  afterLabel='现在'
                  compact
                />
              ) : (
                <p className='y-note'>
                  这条记忆没有七维快照，无法做雷达对比。
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <Empty>
          完成第一次归档、写下自省，或参与一次复盘讨论后，这里会开始积累你的记忆。
        </Empty>
      )}

      <p className='y-note' style={{ paddingTop: 7 }}>
        相似度来自七维向量，不是语义模型；它只说明「当时的处境与现在有多接近」，不评价你选得对不对。
      </p>
    </section>
  );
}
