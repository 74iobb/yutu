import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS, CITIES, TENSIONS } from '@/data/catalog';
import {
  assetLevel,
  CITY_MAP,
  currentStage,
  FEAS_LABEL,
  feasibility,
  stageDirections,
} from '@/lib/model';
import { getCases, rankByField } from '@/lib/search';
import { useImmersive } from '@/lib/uiMotion';
import {
  collectCityMaterials,
  collectDirectionMaterials,
  collectStageMaterials,
  type DirectionMaterial,
} from '@/lib/materials';
import { useYutu } from '@/store/YutuContext';
import CampaignMap from './CampaignMap';
import { Chip, Empty, Kv } from './bits';
import DataSourceBadge from './DataSourceBadge';

const KIND = {
  exclusive: ['互斥', 'y-chip-r'],
  conditional: ['条件相关', 'y-chip-w'],
  shared: ['共用资源', 'y-chip-b'],
} as const;

/** 资源条按三档显示，避免把近似推导当成精确百分比 */
const GAUGE_WIDTH = { full: 100, part: 55, none: 8 } as const;

/** 图上空间有限，去掉括号说明并截断过长方向名 */
function shortDirName(name: string) {
  const base = name.replace(/（[^）]*）/g, '').trim();
  return base.length > 9 ? base.slice(0, 9) + '…' : base;
}

interface Props {
  /** 切回同一步内的「方向清单」视图 */
  onOpenList?: () => void;
  /** 切到同一步内的「归属与摘要」视图 */
  onOpenSummary?: () => void;
}

export default function Step4({ onOpenList, onOpenSummary }: Props = {}) {
  const { state, setPick, clearShortlist } = useYutu();
  const p = state.profile;
  const stage = currentStage(p);
  const query = [p.field, state.intent].filter(Boolean).join(' ').trim();
  const [showFlights, setShowFlights] = useState(true);
  const [showLinks, setShowLinks] = useState(true);
  const [showTensions, setShowTensions] = useState(true);
  const [showMaterials, setShowMaterials] = useState(true);
  const [recenterSignal, setRecenterSignal] = useState(0);
  /* 默认落在本地圈层：近 / 中 / 外圈与方向节点是这一步的核心 */
  const [scope, setScope] = useState<'local' | 'nation'>('local');
  /** 聚焦模式：作战图铺满视口，背后的页面变暗 */
  const [focus, setFocus] = useState(false);
  useImmersive(focus, setFocus);

  /* 从顶部候选条 / 候选表改变选定方向时，若正处于全国视图则自动切回本地圈层，
     否则选中的方向在图上不可见，容易误以为“候选丢了”。 */
  const lastPick = useRef(state.pick);
  useEffect(() => {
    if (state.pick === lastPick.current) return;
    lastPick.current = state.pick;
    if (state.pick) setScope('local');
  }, [state.pick]);
  const options = useMemo(
    () =>
      stageDirections(stage.id).map(d => ({ dir: d, f: feasibility(d, p) })),
    [p, stage.id]
  );

  const highCount = options.filter(x => x.f.level === 'high').length;
  const midCount = options.filter(x => x.f.level === 'mid').length;
  const lowCount = options.filter(x => x.f.level === 'low').length;

  const levelAssets = ASSETS.map(a => ({ asset: a, lv: assetLevel(a, p) }));
  const city = CITY_MAP[p.city];

  const hit = options.find(x => x.dir.name === state.pick);
  const consumed = hit
    ? ASSETS.filter(a => a.consumedBy.includes(hit.dir.name))
    : [];
  const related = hit
    ? TENSIONS.filter(t => t.a === hit.dir.name || t.b === hit.dir.name)
    : [];

  const names = options.map(x => x.dir.name);
  const tensions =
    stage.id === 'explore'
      ? TENSIONS
      : TENSIONS.filter(t => names.includes(t.a) && names.includes(t.b));
  const candidates = state.shortlist
    .map(name => options.find(x => x.dir.name === name))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const dirMaterials = useMemo(() => {
    const base = collectDirectionMaterials(options.map(o => o.dir.name));
    const intent = state.intent.trim();
    if (!intent) return base;
    const out: Record<string, DirectionMaterial> = {};
    Object.entries(base).forEach(([name, mat]) => {
      const ranked = rankByField(
        mat.items.map(item => ({ ...item, excerpt: item.quote ?? '' })),
        intent
      );
      out[name] = { ...mat, items: ranked.matched ? ranked.items : mat.items };
    });
    return out;
  }, [options, state.intent]);
  const stageMaterials = useMemo(
    () => collectStageMaterials(getCases(query || p.field, stage.id).items),
    [query, p.field, stage.id]
  );
  const cityMaterials = useMemo(() => collectCityMaterials(), []);
  const nationMaterialCount = cityMaterials.reduce((n, m) => n + m.count, 0);
  const materialTotal = new Set([
    ...stageMaterials.map(m => m.url),
    ...Object.values(dirMaterials).flatMap(m => m.items.map(i => i.url)),
  ]).size;

  return (
    <section id='y-p3b' aria-label='资源、代价与推进圈'>
      <header className='y-lead'>
        <p className='y-eyebrow'>03 / 资源与推进圈</p>
        <h2>资源、代价与推进圈</h2>
        <p>近圈条件就位，中圈需补条件，外圈条件不足；点选方向看代价。</p>
      </header>

      <div className='y-insight'>
        <span className='y-insight-tag'>本步结论</span>
        <p>
          在 <b>{city.name}</b>，当前可做 <b>{highCount}</b> 个方向，需补条件{' '}
          <b>{midCount}</b> 个{lowCount ? `，条件不足 ${lowCount} 个` : ''}。
          {scope === 'nation'
            ? '当前显示全国网络；切到「本地圈层」即可在图上点选方向、查看代价。'
            : '先在图上选一条，再看下方的代价与资源消耗。'}
        </p>
      </div>

      <div className='y-zone'>
        <div className='y-zone-head'>
          <span className='y-zone-n'>01 / 主图</span>
          <h3>
            {scope === 'nation' ? '全国资源网络' : '城市处境、推进圈与方向'}
          </h3>
          <p>
            {scope === 'nation'
              ? '看你的城市与全国样本城市的连接；点选方向请切回本地圈层'
              : '点选方向节点查看代价'}
          </p>
        </div>
        {focus ? (
          <button
            type='button'
            className='y-focus-backdrop'
            aria-label='退出聚焦，返回页面'
            onClick={() => setFocus(false)}
          />
        ) : null}
        <div
          className={`y-card y-campaign-card y-focus-card${
            focus ? ' is-focus' : ''
          }`}
        >
          <div className='y-campaign-head'>
            <div>
              <p className='y-eyebrow'>
                {scope === 'nation'
                  ? '全国网络 · 近似坐标'
                  : '作战图 · 示意推演'}{' '}
                <DataSourceBadge source='city' showLabel={false} />
              </p>
              <h3>
                {scope === 'nation'
                  ? `${city.name} 与全国样本城市`
                  : `${city.name} 的处境、推进圈与方向`}
                <span className='y-mini'>
                  {scope === 'nation'
                    ? '从你的城市连向全国 46 城；城市坐标为近似值'
                    : '方位与距离为示意，不对应真实地理方位'}
                </span>
              </h3>
            </div>
            <div className='y-campaign-controls'>
              <div className='y-mode' role='group' aria-label='战略图范围'>
                <button
                  type='button'
                  className={scope === 'local' ? 'is-on' : ''}
                  aria-pressed={scope === 'local'}
                  onClick={() => setScope('local')}
                >
                  本地圈层
                </button>
                <button
                  type='button'
                  className={scope === 'nation' ? 'is-on' : ''}
                  aria-pressed={scope === 'nation'}
                  onClick={() => setScope('nation')}
                >
                  全国网络
                </button>
              </div>
              {scope === 'local' ? (
                <>
                  <label className='y-toggle'>
                    <input
                      type='checkbox'
                      checked={showFlights}
                      onChange={e => setShowFlights(e.target.checked)}
                    />
                    飞线
                  </label>
                  <label className='y-toggle'>
                    <input
                      type='checkbox'
                      checked={showLinks}
                      onChange={e => setShowLinks(e.target.checked)}
                    />
                    补给线
                  </label>
                  <label className='y-toggle'>
                    <input
                      type='checkbox'
                      checked={showTensions}
                      onChange={e => setShowTensions(e.target.checked)}
                    />
                    张力
                  </label>
                </>
              ) : null}
              <label className='y-toggle'>
                <input
                  type='checkbox'
                  checked={showMaterials}
                  onChange={e => setShowMaterials(e.target.checked)}
                />
                资料 {scope === 'nation' ? nationMaterialCount : materialTotal}
              </label>
              <button
                type='button'
                className='y-btn y-btn-s'
                onClick={() => setRecenterSignal(n => n + 1)}
              >
                {scope === 'nation' ? '回到全国视野' : '回到我的城市'}
              </button>
              <button
                type='button'
                className='y-btn y-btn-s y-focus-toggle'
                aria-pressed={focus}
                onClick={() => setFocus(v => !v)}
                title={focus ? 'Esc 也可退出' : '作战图铺满视口'}
              >
                {focus ? '退出聚焦' : '聚焦作战图'}
              </button>
            </div>
          </div>

          <div
            className='y-campaign-picks'
            role='group'
            aria-label='候选与已选定方向'
          >
            <span className='y-campaign-picks-label'>候选</span>
            {candidates.length ? (
              candidates.map(({ dir }, i) => {
                const active = hit?.dir.name === dir.name;
                return (
                  <button
                    type='button'
                    key={dir.name}
                    className={`y-campaign-pick-chip${active ? ' is-picked' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setScope('local');
                      setPick(dir.name);
                    }}
                    title={`候选 ${i + 1}：${dir.name}`}
                  >
                    <i>{i + 1}</i>
                    {shortDirName(dir.name)}
                    {active ? <em>已选</em> : null}
                  </button>
                );
              })
            ) : (
              <span className='y-campaign-picks-empty'>
                还没有候选 · 去方向清单点「＋ 加入候选」
              </span>
            )}
            {state.shortlist.length > candidates.length ? (
              <span className='y-campaign-picks-empty'>
                {`另有 ${state.shortlist.length - candidates.length} 条候选不在本阶段`}
              </span>
            ) : null}
            <span className='y-campaign-picks-now' aria-live='polite'>
              {hit ? (
                <>
                  已选定 <b>{shortDirName(hit.dir.name)}</b>
                </>
              ) : (
                '未选定方向'
              )}
            </span>
          </div>

          <div className='y-campaign-map-wrap'>
            <CampaignMap
              profile={p}
              options={options}
              pick={state.pick}
              shortlist={state.shortlist}
              onPick={setPick}
              showLinks={showLinks}
              showTensions={showTensions}
              showFlights={showFlights}
              showMaterials={showMaterials}
              recenterSignal={recenterSignal}
              materials={dirMaterials}
              stageMaterials={stageMaterials}
              scope={scope}
              cityMaterials={cityMaterials}
            />
            <div className='y-campaign-hud'>
              <b>{scope === 'nation' ? '全国网络' : '本地作战图'}</b>
              <span>
                {scope === 'nation'
                  ? `你的城市 → 全国 ${CITIES.length} 城；青=岗位更密，棕=岗位更稀`
                  : '近圈 → 中圈 → 外圈：当前可做 → 需补条件 → 条件不足'}
              </span>
              {scope === 'local' ? (
                <span className='y-campaign-hud-pick'>
                  {hit ? (
                    <>
                      已选定 <b>{hit.dir.name}</b>
                    </>
                  ) : (
                    '尚未选定方向 · 点节点或候选标签'
                  )}
                  {candidates.length ? ` · 候选 ${candidates.length}/4` : ''}
                </span>
              ) : null}
            </div>
            {scope === 'local' ? (
              <div className='camp-tier-strip' aria-hidden='true'>
                <b>推进圈层</b>
                <span>
                  <i style={{ background: '#4f7a58' }} />
                  近圈 55km · 当前可做 {highCount} 个
                </span>
                <span>
                  <i style={{ background: '#a9762f' }} />
                  中圈 105km · 需补条件 {midCount} 个
                </span>
                <span>
                  <i style={{ background: '#9c4a3c' }} />
                  外圈 155km · 条件不足 {lowCount} 个
                </span>
              </div>
            ) : (
              <div className='camp-tier-strip is-nation'>
                <b>本地推进圈层</b>
                <span>近圈 55km · 中圈 105km · 外圈 155km</span>
                <button
                  type='button'
                  className='y-btn y-btn-s'
                  onClick={() => setScope('local')}
                >
                  查看本地圈层
                </button>
              </div>
            )}
          </div>

          <div className='y-campaign-legend'>
            {scope === 'nation' ? (
              <>
                <span>
                  <i className='y-dot' style={{ background: '#1f6fb2' }} />
                  你的城市
                </span>
                <span>
                  <i className='y-dot' style={{ background: '#7ed4c4' }} />
                  目标城市 · 岗位更密
                </span>
                <span>
                  <i className='y-dot' style={{ background: '#c4a678' }} />
                  目标城市 · 岗位更稀
                </span>
                <span>
                  <i
                    className='y-dot'
                    style={{
                      background: 'transparent',
                      border: '1px dashed #7ed4c4',
                    }}
                  />
                  全国飞线
                </span>
                {showMaterials ? (
                  <>
                    <span>
                      <i className='y-dot' style={{ background: '#7a5a86' }} />
                      城市资料（点开看原文）
                    </span>
                    <span>
                      <i
                        className='y-dot'
                        style={{
                          background: 'transparent',
                          border: '1px dashed #b79cc4',
                        }}
                      />
                      资料飞线
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <span className='is-strong'>
                  <i className='y-dot y-dot-picked' />
                  已选定 · 放大 + 光圈
                </span>
                <span className='is-strong'>
                  <i className='y-dot y-dot-cand' />
                  候选 · 金色虚线圈
                </span>
                <span>
                  <i className='y-dot' style={{ background: '#4f7a58' }} />
                  近圈 55km · 当前可做
                </span>
                <span>
                  <i className='y-dot' style={{ background: '#a9762f' }} />
                  中圈 105km · 需补条件
                </span>
                <span>
                  <i className='y-dot' style={{ background: '#9c4a3c' }} />
                  外圈 155km · 条件不足
                </span>
                <span>
                  <i
                    className='y-dot'
                    style={{
                      background: '#fffefb',
                      border: '1px solid #8d887e',
                    }}
                  />
                  一次性资源仓
                </span>
                <span>
                  <i
                    className='y-dot'
                    style={{
                      background: 'transparent',
                      border: '1px dashed #7ed4c4',
                    }}
                  />
                  飞线 · 推进流向
                </span>
                <span>
                  <i
                    className='y-dot'
                    style={{
                      background: 'transparent',
                      border: '1px dashed #9b9183',
                    }}
                  />
                  补给线
                </span>
                <span>
                  <i
                    className='y-dot'
                    style={{
                      background: 'transparent',
                      border: '1px dashed #9c4a3c',
                    }}
                  />
                  方向张力
                </span>
                {showMaterials ? (
                  <>
                    <span>
                      <i className='y-dot' style={{ background: '#7a5a86' }} />
                      资料点（方向 / 中心附近）
                    </span>
                    <span>
                      <i
                        className='y-dot'
                        style={{
                          background: 'transparent',
                          border: '1px dashed #b79cc4',
                        }}
                      />
                      资料飞线 · 资料归属
                    </span>
                  </>
                ) : null}
              </>
            )}
          </div>
          <p className='y-note' style={{ paddingTop: 5 }}>
            {scope === 'nation'
              ? '全国视图使用城市坐标（近似值），飞线表示你的城市与全国样本城市的连接；线宽只反映岗位密度差，不代表成功率或优先级。方向与代价请切回本地圈层。'
              : `圈层距离与方向方位均为示意，不对应真实地理方位；飞线动画只表示推进/补给的方向与资料归属，不代表速度、成功率或优先级；资源仓的百分比是当前存量。方向资料按你填写的「${p.field || '未填写'}」优先检索。`}
          </p>
          <details className='y-disclosure'>
            <summary>这张图代表什么、不代表什么</summary>
            <p>
              这里借用作战图的图层语言，但不设主攻目标、不给成功率，也不把任何人设为敌军。阻力来自条件，不是来自人。
              看清代价之后，选哪条仍然由你决定。
            </p>
          </details>
        </div>
      </div>

      <div className='y-zone'>
        <div className='y-zone-head'>
          <span className='y-zone-n'>02 / 代价</span>
          <h3>资源存量、方向代价与候选 <DataSourceBadge source='resources' showLabel={false} /></h3>
          <p>先在图上点选方向，再对照资源消耗、剩余与候选对比</p>
        </div>
        <div className='y-g2 y-g2-stretch'>
          <div className='y-card y-gap-card'>
            <h3>
              一次性资源存量<span className='y-mini'>用掉或过期即不可逆</span>
            </h3>
            <div>
              {levelAssets.map(({ asset, lv }) => (
                <div
                  className={`y-asset${lv.pct === 0 ? ' is-spent' : ''}`}
                  key={asset.id}
                >
                  <div className='y-asset-top'>
                    <span className='y-asset-n'>{asset.name}</span>
                    <Chip
                      tone={
                        lv.tone === 'full'
                          ? 'c'
                          : lv.tone === 'part'
                            ? 'w'
                            : 'r'
                      }
                    >
                      {lv.label}
                    </Chip>
                  </div>
                  <div className='y-gauge'>
                    <i
                      className={`g-${lv.tone}`}
                      style={{ width: `${GAUGE_WIDTH[lv.tone]}%` }}
                    />
                  </div>
                  <p className='y-asset-b'>
                    <b>有效期：</b>
                    {asset.expiry}
                  </p>
                  <p className='y-asset-b'>{lv.why}</p>
                  <p className='y-asset-b'>
                    <b>规则：</b>
                    {asset.rule}
                  </p>
                  {asset.evidence.map(ev => (
                    <blockquote className='y-quote' key={ev.url + ev.quote}>
                      「{ev.quote}」
                      <cite>
                        {ev.title} ·{' '}
                        <a
                          href={ev.url}
                          target='_blank'
                          rel='noopener noreferrer'
                        >
                          {ev.url}
                        </a>
                      </cite>
                    </blockquote>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className='y-gap-col'>
            <div className='y-card'>
              <h3>
                {hit ? `走「${hit.dir.name}」的代价` : '点选方向后显示代价明细'}
              </h3>
              {!hit ? (
                <Empty>
                  <p>
                    在作战图上点选任一方向节点，这里会列出它会消耗哪些一次性资源、受哪些条件限制。
                  </p>
                  <ul className='y-kv' style={{ marginTop: 8 }}>
                    <li>
                      <b>近圈</b>
                      <span>当前可做：现有条件下可以开始的路径。</span>
                    </li>
                    <li>
                      <b>中圈</b>
                      <span>需补条件：现金流、时间或技能缺口未满足。</span>
                    </li>
                    <li>
                      <b>外圈</b>
                      <span>条件不足：当前约束下代价明显偏高。</span>
                    </li>
                    <li>
                      <b>补给线</b>
                      <span>该方向会消耗的一次性资源。</span>
                    </li>
                    <li>
                      <b>张力</b>
                      <span>方向之间的互斥、共用资源或条件关系。</span>
                    </li>
                  </ul>
                </Empty>
              ) : (
                <>
                  <Kv
                    rows={[
                      ['推进阻力', FEAS_LABEL[hit.f.level].t],
                      ['前置条件', hit.dir.prereq],
                      ...(hit.f.reasons.length
                        ? ([['判定依据', hit.f.reasons.join('；')]] as [
                            string,
                            string,
                          ][])
                        : []),
                      [
                        '消耗资源',
                        consumed.length
                          ? consumed
                              .map(
                                a =>
                                  `${a.name}（当前${assetLevel(a, p).label}）`
                              )
                              .join('、')
                          : '不消耗一次性资源，可与其他方向并行。',
                      ],
                      ...(related.length
                        ? ([
                            [
                              '相关张力',
                              related
                                .map(t => {
                                  const other =
                                    t.a === hit.dir.name ? t.b : t.a;
                                  return `${other}（${KIND[t.kind][0]}）`;
                                })
                                .join('、'),
                            ],
                          ] as [string, string][])
                        : []),
                    ]}
                  />
                  <p className='y-note' style={{ paddingTop: 7 }}>
                    以上是代价，不是建议。系统不判定这条路线会不会成功，也不替你排序。
                  </p>
                  {showMaterials && dirMaterials[hit.dir.name] ? (
                    <div className='y-material-list'>
                      <h4>
                        这条方向的资料（
                        {dirMaterials[hit.dir.name].items.length} 条 ·
                        已标在图上）
                        {state.intent.trim() ? (
                          <span className='y-mini'>按想法优先</span>
                        ) : null}
                      </h4>
                      <ul className='y-mat-list'>
                        {dirMaterials[hit.dir.name].items
                          .slice(0, 4)
                          .map(item => (
                            <li key={item.url} className='y-mat-row'>
                              <a
                                className='y-mat-link'
                                href={item.url}
                                target='_blank'
                                rel='noopener noreferrer'
                                title={item.title}
                              >
                                <span className='y-mat-title'>
                                  {item.title}
                                </span>
                                <span className='y-mat-open'>
                                  原文 <i aria-hidden='true'>↗</i>
                                </span>
                              </a>
                              {item.kind ? (
                                <span className='y-mat-kind'>
                                  {item.kind}
                                </span>
                              ) : null}
                              {item.quote ? (
                                <details className='y-mat-more'>
                                  <summary>摘要</summary>
                                  <p>{item.quote}</p>
                                </details>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                      {dirMaterials[hit.dir.name].items.length > 4 ? (
                        <p className='y-note'>
                          另有 {dirMaterials[hit.dir.name].items.length - 4}{' '}
                          条在图上以资料点显示。
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className='y-card'>
              <h3>
                我的候选对比
                <span className='y-mini'>最多 4 条 · 在方向清单加入</span>
                {state.shortlist.length ? (
                  <button
                    type='button'
                    className='y-btn y-btn-s'
                    style={{ marginLeft: 8 }}
                    onClick={clearShortlist}
                  >
                    清空
                  </button>
                ) : null}
              </h3>
              {!candidates.length ? (
                <Empty>
                  {state.shortlist.length ? (
                    <>
                      <p>
                        候选中的方向不属于当前阶段，暂时无法对比。可以清空后回到方向清单重新挑选。
                      </p>
                      <div className='y-row' style={{ marginTop: 8 }}>
                        <button
                          type='button'
                          className='y-btn y-btn-s'
                          onClick={clearShortlist}
                        >
                          清空候选
                        </button>
                        <button
                          type='button'
                          className='y-btn y-btn-s'
                          onClick={() => onOpenList?.()}
                        >
                          去方向清单挑方向
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>
                        还没有候选。回到方向清单，在方向卡片底部点「＋
                        加入候选」。
                      </p>
                      <button
                        type='button'
                        className='y-btn y-btn-s'
                        style={{ marginTop: 8 }}
                        onClick={() => onOpenList?.()}
                      >
                        去方向清单挑方向
                      </button>
                    </>
                  )}
                </Empty>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className='y-short-table'>
                    <thead>
                      <tr>
                        <th>方向</th>
                        <th>可行性</th>
                        <th>前置条件</th>
                        <th>消耗资源</th>
                        <th>相关张力</th>
                        <th>图上</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map(({ dir, f }) => {
                        const consumedNames = ASSETS.filter(a =>
                          a.consumedBy.includes(dir.name)
                        );
                        const rel = TENSIONS.filter(
                          t => t.a === dir.name || t.b === dir.name
                        );
                        const picked = state.pick === dir.name;
                        return (
                          <tr
                            key={dir.name}
                            className={picked ? 'is-picked' : undefined}
                          >
                            <td>
                              {dir.name}
                              <em className='y-dir-cand'>
                                候选 {state.shortlist.indexOf(dir.name) + 1}
                              </em>
                              {picked ? (
                                <em className='y-dir-picked'>已选定</em>
                              ) : null}
                            </td>
                            <td>
                              <Chip
                                tone={
                                  FEAS_LABEL[f.level].cls.replace(
                                    'y-chip-',
                                    ''
                                  ) as 'c' | 'w' | 'r'
                                }
                              >
                                {FEAS_LABEL[f.level].t}
                              </Chip>
                            </td>
                            <td>{dir.prereq}</td>
                            <td>
                              {consumedNames.length
                                ? consumedNames
                                    .map(
                                      a =>
                                        `${a.name}（${assetLevel(a, p).label}）`
                                    )
                                    .join('、')
                                : '不消耗一次性资源'}
                            </td>
                            <td>
                              {rel.length
                                ? rel
                                    .map(t => {
                                      const other =
                                        t.a === dir.name ? t.b : t.a;
                                      return `${other}（${KIND[t.kind][0]}）`;
                                    })
                                    .join('、')
                                : '—'}
                            </td>
                            <td>
                              <button
                                type='button'
                                className='y-btn y-btn-s y-short-locate'
                                aria-pressed={picked}
                                disabled={picked}
                                onClick={() => {
                                  setScope('local');
                                  setPick(dir.name);
                                }}
                              >
                                {picked ? '已选定' : '图上选中'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <details className='y-zone y-fold-zone'>
        <summary className='y-zone-head'>
          <span className='y-zone-n'>03 / 关系</span>
          <h3>方向互斥、共用资源与条件关系</h3>
          <p>互斥、共用资源与条件判定，均附检索依据</p>
        </summary>
        <div className='y-card'>
          <h3>
            方向之间的张力
            <span className='y-mini'>
              互斥、共用资源与条件判定，均附检索依据
            </span>
          </h3>
          {!tensions.length ? (
            <Empty>这一阶段的方向之间暂无已检索到的硬性互斥关系。</Empty>
          ) : (
            <div className='y-tension-grid'>
              {tensions.map(t => (
                <div
                  className={`y-tension ${
                    t.kind === 'exclusive'
                      ? 't-exclusive'
                      : t.kind === 'shared'
                        ? 't-shared'
                        : ''
                  }`}
                  key={t.a + t.b}
                >
                  <div className='y-asset-top'>
                    <span className='y-asset-n' style={{ fontSize: 12.5 }}>
                      {t.a} × {t.b}
                    </span>
                    <Chip
                      tone={
                        KIND[t.kind][1].replace('y-chip-', '') as
                          'r' | 'w' | 'b'
                      }
                    >
                      {KIND[t.kind][0]}
                    </Chip>
                  </div>
                  <p className='y-asset-b'>{t.note}</p>
                  <blockquote className='y-quote'>
                    「{t.basis}」
                    <cite>
                      <a href={t.url} target='_blank' rel='noopener noreferrer'>
                        {t.url}
                      </a>
                    </cite>
                  </blockquote>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className='y-nav'>
        <button type='button' className='y-btn' onClick={() => onOpenList?.()}>
          ← 返回方向清单
        </button>
        <button
          type='button'
          className='y-btn y-btn-main'
          onClick={() => onOpenSummary?.()}
        >
          看归属与摘要 →
        </button>
      </div>
    </section>
  );
}
