import { ASSETS } from '@/data/catalog';
import { assetLevel, CITY_MAP, currentStage, type FeasibleOption } from '@/lib/model';
import type { Profile } from '@/types';

const TIERS = [
  { k: 'high' as const, n: '当前可做', color: '#4f7a58', y: 96 },
  { k: 'mid' as const, n: '需补条件', color: '#a9762f', y: 222 },
  { k: 'low' as const, n: '暂不建议', color: '#9c4a3c', y: 348 },
];

interface Props {
  profile: Profile;
  options: FeasibleOption[];
  pick: string | null;
  onPick: (name: string) => void;
}

export default function BoardSvg({ profile, options, pick, onPick }: Props) {
  const stage = currentStage(profile);
  const c = CITY_MAP[profile.city];
  const slots: Record<string, { x: number; y: number }> = {};
  const levels = ASSETS.map((a) => ({ asset: a, lv: assetLevel(a, profile) }));

  const byTier: Record<string, FeasibleOption[]> = { high: [], mid: [], low: [] };
  options.forEach((x) => byTier[x.f.level].push(x));

  const nodes: {
    x: number;
    y: number;
    w: number;
    h: number;
    item: FeasibleOption;
    tier: (typeof TIERS)[number];
  }[] = [];
  (['high', 'mid', 'low'] as const).forEach((k) => {
    const tier = TIERS.find((t) => t.k === k)!;
    byTier[k].forEach((x, i) => {
      const perRow = 2;
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      const bw = 128;
      const gap = 10;
      nodes.push({
        x: 152 + col * (bw + gap),
        y: tier.y - 34 + row * 29,
        w: bw,
        h: 25,
        item: x,
        tier,
      });
    });
  });

  return (
    <svg id="y-board" viewBox="0 0 620 430" role="img" aria-labelledby="y-board-alt">
      <title id="y-board-alt">
        态势图：左侧为你的当前位置，右侧按推进阻力分三层排布可选方向。连线表示该方向会消耗哪一项一次性资源。点选任一方向可查看它的代价明细。
      </title>

      <rect
        x={12}
        y={166}
        width={124}
        height={104}
        rx={8}
        fill="#e7f0f8"
        stroke="#1f6fb2"
        strokeWidth={1.5}
      />
      <text x={74} y={190} textAnchor="middle" fontSize={12.5} fill="#1f6fb2" fontWeight={600}>
        当前位置
      </text>
      {[
        `${c.name}·${stage.name}`,
        `经济压力 ${profile.s.econ}`,
        `家庭负担 ${profile.s.family}`,
        `年龄 ${profile.s.age} 岁`,
      ].map((t, i) => (
        <text key={t} x={74} y={208 + i * 15} textAnchor="middle" fontSize={10.5} fill="#5c5850">
          {t}
        </text>
      ))}

      {levels.map(({ asset, lv }, idx) => {
        const y = 74 + idx * 138;
        slots[asset.name] = { x: 560, y };
        return (
          <g key={asset.id}>
            <rect
              x={512}
              y={y - 16}
              width={100}
              height={32}
              rx={5}
              fill={lv.pct === 0 ? '#f1eee7' : '#fffefb'}
              stroke={lv.pct === 0 ? '#cfc8bb' : '#8d887e'}
              strokeWidth={1}
              strokeDasharray={lv.pct === 0 ? '3 2' : undefined}
            />
            <text
              x={562}
              y={y - 2}
              textAnchor="middle"
              fontSize={10}
              fill={lv.pct === 0 ? '#8d887e' : '#23221f'}
              fontWeight={600}
            >
              {asset.name.length > 9 ? asset.name.slice(0, 9) + '…' : asset.name}
            </text>
            <text
              x={562}
              y={y + 11}
              textAnchor="middle"
              fontSize={9.5}
              fill={lv.tone === 'full' ? '#4f7a58' : lv.tone === 'part' ? '#a9762f' : '#9c4a3c'}
            >
              {lv.label}
            </text>
          </g>
        );
      })}

      {TIERS.map((ti) => (
        <g key={ti.k}>
          <line
            x1={146}
            y1={ti.y - 48}
            x2={500}
            y2={ti.y - 48}
            stroke="#e0dbd1"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text x={150} y={ti.y - 52} fontSize={10.5} fill={ti.color} fontWeight={600}>
            {ti.n}
          </text>
        </g>
      ))}

      {nodes.map((nd) =>
        levels.map(({ asset }) => {
          if (!asset.consumedBy.includes(nd.item.dir.name)) return null;
          const s = slots[asset.name];
          if (!s) return null;
          const sel = pick === nd.item.dir.name;
          return (
            <path
              key={`${nd.item.dir.name}-${asset.id}`}
              d={`M${nd.x + nd.w} ${nd.y + nd.h / 2} C ${nd.x + nd.w + 40} ${
                nd.y + nd.h / 2
              }, ${s.x - 60} ${s.y}, ${s.x - 48} ${s.y}`}
              fill="none"
              stroke={sel ? '#a9762f' : '#9b9183'}
              strokeWidth={sel ? 2.4 : 1.4}
              opacity={sel ? 1 : 0.8}
            />
          );
        })
      )}

      {nodes.map((nd) => {
        const sel = pick === nd.item.dir.name;
        let label = nd.item.dir.name.replace(/（[^）]*）/, '');
        if (label.length > 11) label = label.slice(0, 11) + '…';
        return (
          <g
            key={nd.item.dir.name}
            className="y-opt"
            tabIndex={0}
            role="button"
            aria-pressed={sel}
            aria-label={`${nd.item.dir.name}，${nd.tier.n}`}
            onClick={() => onPick(nd.item.dir.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick(nd.item.dir.name);
              }
            }}
          >
            <title>{nd.item.dir.name}</title>
            <rect
              className="y-opt-box"
              x={nd.x}
              y={nd.y}
              width={nd.w}
              height={nd.h}
              rx={5}
              fill={sel ? nd.tier.color : '#fffefb'}
              stroke={nd.tier.color}
              strokeWidth={sel ? 2 : 1.2}
            />
            <text
              x={nd.x + nd.w / 2}
              y={nd.y + 16.5}
              textAnchor="middle"
              fontSize={10.5}
              fill={sel ? '#fffefb' : '#23221f'}
              fontWeight={sel ? 600 : 400}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
