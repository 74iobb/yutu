import { useEffect, useRef, useState } from 'react';
import { CITIES, PROVINCES, URBAN_LABEL, type Urban } from '@/data/catalog';
import { cityById, currentStage, DIMS, stageReason } from '@/lib/model';
import { matchFieldCategory } from '@/lib/searchCore';
import { DEFAULT_PROFILE, useYutu } from '@/store/YutuContext';
import StructuredScale from './StructuredScale';
import GrowthDelta from './GrowthDelta';
import GapPhoto from './GapPhoto';
import { Kv, Say } from './bits';
import DataSourceBadge from './DataSourceBadge';

export default function Step1() {
  const { state, updateProfile, updateScore, applyCity, setStep, flash } =
    useYutu();
  const p = state.profile;
  const stage = currentStage(p);
  const city = cityById(p.city);
  const urban = URBAN_LABEL[p.urban];
  const fieldMatch = matchFieldCategory(p.field);
  /** 尚未进入第 2 步，且档案仍与初始模板完全一致：必须提示这是示例值 */
  const initialValues =
    state.maxStep < 2 &&
    p.city === DEFAULT_PROFILE.city &&
    p.urban === DEFAULT_PROFILE.urban &&
    p.identity === DEFAULT_PROFILE.identity &&
    p.field === DEFAULT_PROFILE.field &&
    DIMS.every(d => p.s[d.k] === DEFAULT_PROFILE.s[d.k]);
  /** 方向为空时，主按钮不再只是弹 toast：聚焦输入框并给出一次短促反馈 */
  const fieldRef = useRef<HTMLInputElement>(null);
  const [shake, setShake] = useState(false);
  /** 显影反馈：只要开始填写/校准，右侧配图就从低对比显影到清晰 */
  const [touched, setTouched] = useState(
    () => state.maxStep >= 2 || state.snapshot0 !== null
  );

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 720);
    return () => window.clearTimeout(t);
  }, [shake]);

  function rejectField() {
    fieldRef.current?.focus();
    setShake(false);
    requestAnimationFrame(() => setShake(true));
  }

  /** 页内快速定位：滚动到对应区块，留给吸顶头部一点余量 */
  function jumpTo(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    el.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  return (
    <section
      id='y-p1'
      role='tabpanel'
      aria-labelledby='y-s1'
      className='y-p1-develop'
      data-develop={touched ? 'on' : 'off'}
      onFocusCapture={() => setTouched(true)}
      onPointerDownCapture={() => setTouched(true)}
      onChangeCapture={() => setTouched(true)}
    >
      <header className='y-lead'>
        <p className='y-eyebrow'>STEP 01 · 处境</p>
        <h2>先把你的情况填清楚</h2>
      </header>

      {initialValues ? (
        <p
          className='y-note'
          role='status'
          style={{
            margin: '0 0 12px',
            padding: '9px 12px',
            borderLeft: '2px solid var(--step-accent, #4fc9e6)',
            background: 'var(--step-accent-soft, rgba(79, 201, 230, 0.08))',
            borderRadius: 8,
          }}
        >
          当前显示的是初始示例（{city.name} · {p.s.age} 岁 ·{' '}
          {p.field || '未填写方向'}），不是你的真实情况。请按你的城市、年龄与处境修改；改动后这行提示会自动消失。
        </p>
      ) : null}

      <GrowthDelta />

      <nav className='y-anchor-nav' aria-label='填写信息分区'>
        <span>快速定位</span>
        <button type='button' onClick={() => jumpTo('y-p1-basic')}>
          基本事实
        </button>
        <button type='button' onClick={() => jumpTo('y-p1-measure')}>
          结构化测量
        </button>
        <button type='button' onClick={() => jumpTo('y-p1-calibrate')}>
          校准量表
        </button>
        <button type='button' onClick={() => jumpTo('y-p1-result')}>
          判定结果
        </button>
      </nav>

      <div className='y-layout-main'>
        <div className='y-layout-col'>
          <div className='y-card' id='y-p1-basic'>
            <p className='y-eyebrow'>01 / 基本事实</p>
            <h3>
              基本信息<span className='y-mini'>必填</span>
            </h3>
            <div className='y-gs'>
              <div>
                <label htmlFor='y-city'>常住城市</label>
                <select
                  id='y-city'
                  value={p.city}
                  onChange={e => applyCity(e.target.value)}
                >
                  {PROVINCES.map(prov => {
                    const list = CITIES.filter(c => c.province === prov);
                    if (!list.length) return null;
                    return (
                      <optgroup key={prov} label={prov}>
                        {list.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}（{c.tier}）
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <label htmlFor='y-age-in'>年龄</label>
                <select
                  id='y-age-in'
                  value={p.s.age}
                  onChange={e => updateScore('age', Number(e.target.value))}
                >
                  {Array.from({ length: 30 }, (_, i) => i + 16).map(a => (
                    <option key={a} value={a}>
                      {a} 岁
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>城乡属性</label>
                <div className='y-seg' role='group' aria-label='城乡属性'>
                  {(Object.keys(URBAN_LABEL) as Urban[]).map(u => (
                    <label key={u}>
                      <input
                        type='radio'
                        name='y-urban'
                        value={u}
                        checked={p.urban === u}
                        onChange={() => applyCity(p.city, u)}
                      />
                      <span>{URBAN_LABEL[u].n}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label>当前身份</label>
                <div className='y-seg' role='group' aria-label='当前身份'>
                  <label>
                    <input
                      type='radio'
                      name='y-ident'
                      value='study'
                      checked={p.identity === 'study'}
                      onChange={() => updateProfile({ identity: 'study' })}
                    />
                    <span>在校/待业</span>
                  </label>
                  <label>
                    <input
                      type='radio'
                      name='y-ident'
                      value='work'
                      checked={p.identity === 'work'}
                      onChange={() => updateProfile({ identity: 'work' })}
                    />
                    <span>已工作</span>
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor='y-field'>
                  {p.identity === 'study'
                    ? '所学专业 / 方向'
                    : '所从事的方向 / 行业'}
                  <span className='y-mini' style={{ marginLeft: 6 }}>
                    决定后续检索
                  </span>
                </label>
                <input
                  ref={fieldRef}
                  type='text'
                  id='y-field'
                  className={shake ? 'y-shake' : undefined}
                  aria-invalid={shake || undefined}
                  placeholder={
                    p.identity === 'study'
                      ? '例：土木工程 / 护理 / 计算机 / 学前教育'
                      : '例：施工管理 / 临床护理 / 电商运营 / 体制内'
                  }
                  value={p.field}
                  onChange={e => updateProfile({ field: e.target.value })}
                  onAnimationEnd={() => setShake(false)}
                />
                {shake ? (
                  <p className='y-field-error' role='alert'>
                    先写一个方向，哪怕只是一个大类。
                  </p>
                ) : null}
                {p.field.trim() && !fieldMatch ? (
                  <p className='y-note' style={{ paddingTop: 4 }}>
                    未命中内置大类，将按关键词检索。
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className='y-card' id='y-p1-measure'>
            <p className='y-eyebrow'>02 / 结构化测量</p>
            <h3>结构化处境测量</h3>
            <StructuredScale />
          </div>

          <details className='y-detail' id='y-p1-calibrate'>
            <summary>校准量表（可选 · 手动微调）</summary>
            <div className='y-detail-body'>
              <p className='y-note' style={{ paddingBottom: 8 }}>
                推荐先完成上方结构化测量，分数会自动写入这里。手动调整会覆盖本次测量结果，仅建议在你掌握额外信息时使用。
              </p>
              <div className='y-scale-grid'>
                {DIMS.filter(d => !d.derived).map(d => (
                  <div className='y-dim' key={d.k}>
                    <div className='y-dim-top'>
                      <span className='y-dim-n'>{d.n}</span>
                      <output className='y-dim-v' htmlFor={`y-in-${d.k}`}>
                        {p.s[d.k]} / 100
                      </output>
                    </div>
                    <input
                      type='range'
                      id={`y-in-${d.k}`}
                      min={d.min}
                      max={d.max}
                      step={1}
                      value={p.s[d.k]}
                      aria-label={d.n}
                      onChange={e => updateScore(d.k, Number(e.target.value))}
                    />
                    <div className='y-ends'>
                      <span>{d.lo}</span>
                      <span>{d.hi}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className='y-note' style={{ paddingTop: 6 }}>
                地理位置不在此处自评，由你选择的城市与城乡属性导出。
              </p>
            </div>
          </details>
          <GapPhoto variant='plan' quote='把这一步写实，后面的判断才准。' />
        </div>

        <aside className='y-aside'>
          <div className='y-card y-focus-card' id='y-p1-result'>
            <p className='y-eyebrow'>判定结果</p>
            <p className='y-stage-name'>
              {stage.name} <DataSourceBadge source='stage' showLabel={false} />
              <small>你当前所在的阶段</small>
            </p>
            <Kv
              rows={[
                ['判定依据', stageReason(p)],
                [
                  '检索方向',
                  p.field.trim()
                    ? `${p.field}${
                        fieldMatch
                          ? ` → 「${fieldMatch.label}」大类`
                          : ' → 关键词检索'
                      }`
                    : '尚未填写（下一步会要求先写方向）',
                ],
                ['阶段任务', stage.desc],
                [
                  '地理位置',
                  `${p.s.place} / 100（由 ${city.name}·${urban.n} 导出；城市属性为近似值）`,
                ],
              ]}
            />
            <div style={{ marginTop: 10 }}>
              <Say>
                按你填的情况，你处在「{stage.name}」。下一步会显示{city.name}
                与你所在区域里的城市信息与真实讨论。
              </Say>
            </div>
          </div>
          <GapPhoto
            variant='writing'
            quote='你每写下一项，这张图就清晰一点。'
            still
          />
        </aside>
      </div>

      <div className='y-nav y-nav-step'>
        <span className='y-note'>
          {p.field.trim()
            ? '方向已填写，可以进入下一步；之后随时可以回来修改。'
            : '先写一个方向，哪怕只是一个大类，才能匹配后续案例。'}
        </span>
        <button
          type='button'
          className='y-btn y-btn-main'
          onClick={() => {
            if (!p.field.trim()) {
              rejectField();
              flash(
                '先写一个方向，哪怕只是一个大类；后面才能匹配对应的案例。'
              );
              return;
            }
            setStep(2);
          }}
        >
          进入第二步：了解你所处的环境 →
        </button>
      </div>
    </section>
  );
}
