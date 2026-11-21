import { useEffect, useMemo, useState } from 'react';
import { CITY_MAP, type City } from '@/data/catalog';
import {
  computeAssessment,
  DEFAULT_ASSESSMENT,
  type AssessmentAnswers,
  type AssessmentResult,
} from '@/lib/assessment';
import { useYutu } from '@/store/YutuContext';
import { Chip } from './bits';
import DataSourceBadge from './DataSourceBadge';

const STORAGE_KEY = 'yutu.assessment.v1';

const STEPS = [
  { id: 'econ', label: '经济', hint: '收入、支出、储备与还债' },
  { id: 'family', label: '家庭', hint: '赡养、照护与是否主要支柱' },
  { id: 'industry', label: '行业', hint: '招聘趋势与工作稳定性' },
  { id: 'history', label: '体验', hint: '走通过的学习循环与验证项目' },
  { id: 'explore', label: '探索', hint: '面对不确定时的具体行为' },
] as const;

const LIVE_DIMS = [
  { k: 'econ', label: '经济压力' },
  { k: 'family', label: '家庭负担' },
  { k: 'cycle', label: '行业周期' },
  { k: 'inertia', label: '认知惯性' },
  { k: 'history', label: '体验历史' },
] as const;

function readAnswers(): AssessmentAnswers {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        ...DEFAULT_ASSESSMENT,
        explore: [...DEFAULT_ASSESSMENT.explore] as AssessmentAnswers['explore'],
      };
    const parsed = JSON.parse(raw) as Partial<AssessmentAnswers>;
    const explore =
      Array.isArray(parsed.explore) && parsed.explore.length === 4
        ? (parsed.explore.map((v) => Number(v) || 3) as AssessmentAnswers['explore'])
        : ([...DEFAULT_ASSESSMENT.explore] as AssessmentAnswers['explore']);
    return { ...DEFAULT_ASSESSMENT, ...parsed, explore };
  } catch {
    return {
      ...DEFAULT_ASSESSMENT,
      explore: [...DEFAULT_ASSESSMENT.explore] as AssessmentAnswers['explore'],
    };
  }
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="y-measure-field">
      <label htmlFor={id}>{label}</label>
      <div className="y-measure-input">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix ? <span>{suffix}</span> : null}
      </div>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: number | string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="y-measure-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const TREND_OPTIONS = [
  { value: '1', label: '1 · 明显收缩（招聘减少/裁员）' },
  { value: '2', label: '2 · 略有收缩' },
  { value: '3', label: '3 · 基本持平' },
  { value: '4', label: '4 · 略有扩张' },
  { value: '5', label: '5 · 明显扩张' },
];

const SECURITY_OPTIONS = [
  { value: '1', label: '1 · 很不稳定' },
  { value: '2', label: '2 · 较不稳定' },
  { value: '3', label: '3 · 一般' },
  { value: '4', label: '4 · 较稳定' },
  { value: '5', label: '5 · 很稳定' },
];

const BURDEN_OPTIONS = [
  { value: '1', label: '1 · 几乎没有' },
  { value: '2', label: '2 · 较轻' },
  { value: '3', label: '3 · 一般' },
  { value: '4', label: '4 · 较重' },
  { value: '5', label: '5 · 很重' },
];

const LOOP_OPTIONS = [
  { value: '0', label: '0 次' },
  { value: '1', label: '1 次' },
  { value: '2', label: '2 次' },
  { value: '3', label: '3 次及以上' },
];

const EXPLORE_ITEMS = [
  '过去 6 个月，我主动了解过与当前路线不同的选择。',
  '面对不确定，我倾向于先做一个小尝试，而不是等到完全想清楚。',
  '我愿意让身边的人知道我正在探索或试错。',
  '我获取新方向信息主要靠主动检索/访谈，而不是只刷推荐。',
];

export default function StructuredScale() {
  const { state, applyScores, flash } = useYutu();
  const city: City = CITY_MAP[state.profile.city] ?? CITY_MAP.nanchong;
  const [answers, setAnswers] = useState<AssessmentAnswers>(readAnswers);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [step, setStep] = useState(0);

  /** 填写过程中的实时预览；应用前不写入处境 */
  const live = useMemo(
    () => computeAssessment(answers, city.jobs),
    [answers, city.jobs]
  );

  /* 输入即保存，避免刷新后丢失；真正写入处境仍需点「应用」 */
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
      } catch {
        /* ignore quota */
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [answers]);

  const update = (patch: Partial<AssessmentAnswers>) => {
    setAnswers((a) => ({ ...a, ...patch }));
    setResult(null);
  };

  const setExplore = (i: number, value: number) => {
    const next = [...answers.explore] as AssessmentAnswers['explore'];
    next[i] = value;
    update({ explore: next });
  };

  const calculate = () => {
    applyScores(live.scores);
    setResult(live);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      /* ignore quota */
    }
    flash('已按结构化测量更新量表。下方校准值可以再手动微调。');
  };

  const resetDefaults = () => {
    const next = {
      ...DEFAULT_ASSESSMENT,
      explore: [...DEFAULT_ASSESSMENT.explore] as AssessmentAnswers['explore'],
    };
    setAnswers(next);
    setResult(null);
    setStep(0);
  };

  const confidenceTone: 'c' | 'w' | 'r' =
    live.label === '高' ? 'c' : live.label === '中' ? 'w' : 'r';
  const active = STEPS[step];

  return (
    <details className="y-measure">
      <summary>
        展开填写（约 2 分钟）
        <span>五组事实与行为问题；右侧实时预览，应用后才写入量表</span>
      </summary>

      <div className="y-measure-body">
        <p className="y-note">
          把每个维度拆成可回答的事实或频率。填写不会立刻改动处境，点「应用这组测量」后才写入。
        </p>

        <div className="y-measure-rail" role="tablist" aria-label="结构化测量分组">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={step === i}
              className={`${step === i ? 'is-on' : ''}${i < step ? ' is-done' : ''}`}
              title={s.hint}
              onClick={() => setStep(i)}
            >
              <i>{i < step ? '✓' : i + 1}</i>
              {s.label}
            </button>
          ))}
        </div>
        <div className="y-measure-progress" aria-hidden="true">
          <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <div className="y-measure-main">
          <div className="y-measure-step" key={step}>
            <p className="y-measure-step-label">
              <b>
                {step + 1} / {STEPS.length} · {active.label}
              </b>
              <span>{active.hint}</span>
            </p>

            {step === 0 ? (
              <section className="y-measure-section">
                <h4>经济压力</h4>
                <div className="y-measure-fields">
                  <NumberField
                    id="y-m-income"
                    label="月收入"
                    value={answers.income}
                    min={0}
                    max={200000}
                    step={100}
                    suffix="元"
                    onChange={(v) => update({ income: v })}
                  />
                  <NumberField
                    id="y-m-expense"
                    label="月支出"
                    value={answers.expense}
                    min={0}
                    max={200000}
                    step={100}
                    suffix="元"
                    onChange={(v) => update({ expense: v })}
                  />
                  <NumberField
                    id="y-m-savings"
                    label="储蓄可支撑"
                    value={answers.savingsMonths}
                    min={0}
                    max={36}
                    suffix="个月"
                    onChange={(v) => update({ savingsMonths: v })}
                  />
                  <NumberField
                    id="y-m-debt"
                    label="每月还债占收入"
                    value={answers.debtPct}
                    min={0}
                    max={100}
                    suffix="%"
                    onChange={(v) => update({ debtPct: v })}
                  />
                </div>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="y-measure-section">
                <h4>家庭负担</h4>
                <div className="y-measure-fields">
                  <NumberField
                    id="y-m-dependents"
                    label="需赡养/抚养人数"
                    value={answers.dependents}
                    min={0}
                    max={8}
                    suffix="人"
                    onChange={(v) => update({ dependents: v })}
                  />
                  <NumberField
                    id="y-m-care"
                    label="每周照护时长"
                    value={answers.careHours}
                    min={0}
                    max={80}
                    suffix="小时"
                    onChange={(v) => update({ careHours: v })}
                  />
                  <SelectField
                    id="y-m-earner"
                    label="是否主要经济支柱"
                    value={answers.primaryEarner ? 'yes' : 'no'}
                    onChange={(v) => update({ primaryEarner: v === 'yes' })}
                    options={[
                      { value: 'yes', label: '是' },
                      { value: 'no', label: '否' },
                    ]}
                  />
                  <SelectField
                    id="y-m-burden"
                    label="主观家庭负担"
                    value={String(answers.familyBurden)}
                    onChange={(v) => update({ familyBurden: Number(v) })}
                    options={BURDEN_OPTIONS}
                  />
                </div>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="y-measure-section">
                <h4>行业与工作</h4>
                <div className="y-measure-fields">
                  <SelectField
                    id="y-m-trend"
                    label="所在行业/岗位招聘趋势"
                    value={String(answers.industryTrend)}
                    onChange={(v) => update({ industryTrend: Number(v) })}
                    options={TREND_OPTIONS}
                  />
                  <SelectField
                    id="y-m-security"
                    label="当前工作稳定性"
                    value={String(answers.jobSecurity)}
                    onChange={(v) => update({ jobSecurity: Number(v) })}
                    options={SECURITY_OPTIONS}
                  />
                </div>
                <p className="y-note">
                  以本地岗位密度作为客观项参与计算（近似值，展示为高 / 中 / 低）。
                </p>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="y-measure-section">
                <h4>体验历史</h4>
                <div className="y-measure-fields">
                  <SelectField
                    id="y-m-loops"
                    label="完整走通的体验学习循环"
                    value={String(answers.loops)}
                    onChange={(v) => update({ loops: Number(v) })}
                    options={LOOP_OPTIONS}
                  />
                  <NumberField
                    id="y-m-projects"
                    label="完成的小型验证项目"
                    value={answers.projects}
                    min={0}
                    max={10}
                    suffix="项"
                    onChange={(v) => update({ projects: v })}
                  />
                </div>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="y-measure-explore">
                <h4>探索行为</h4>
                <p className="y-note">
                  1 = 从不/完全不同意，3 = 有时/一般，5 = 经常/完全同意。
                </p>
                {EXPLORE_ITEMS.map((text, i) => (
                  <div className="y-measure-item" key={text}>
                    <span>{text}</span>
                    <select
                      aria-label={text}
                      value={String(answers.explore[i])}
                      onChange={(e) => setExplore(i, Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </section>
            ) : null}
          </div>

          <aside className="y-measure-live" aria-live="polite">
            <div className="y-measure-live-head">
              <span className="y-eyebrow">实时预览</span>
              <DataSourceBadge source="assessment" showLabel={false} />
              <Chip tone={confidenceTone}>
                质量 {live.label} · {live.confidence}
              </Chip>
            </div>
            <p className="y-note">尚未写入量表；应用后会同步更新右侧判定与七维处境。</p>
            <div className="y-measure-live-bars">
              {LIVE_DIMS.map((d) => (
                <div key={d.k}>
                  <span>{d.label}</span>
                  <i>
                    <em style={{ width: `${live.scores[d.k]}%` }} />
                  </i>
                  <b>{live.scores[d.k]}</b>
                </div>
              ))}
            </div>
            {live.notes.length ? (
              <p className="y-measure-live-note">{live.notes[0]}</p>
            ) : (
              <p className="y-measure-live-note is-ok">
                填写完整度与一致性良好；它仍不是心理测量信度。
              </p>
            )}
            <button
              type="button"
              className="y-btn y-btn-main y-btn-s y-measure-apply"
              onClick={calculate}
            >
              应用这组测量
            </button>
          </aside>
        </div>

        <div className="y-measure-actions">
          <button
            type="button"
            className="y-btn y-btn-s"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            ← 上一步
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="y-btn y-btn-s"
              onClick={() =>
                setStep((s) => Math.min(STEPS.length - 1, s + 1))
              }
            >
              下一组 →
            </button>
          ) : (
            <button
              type="button"
              className="y-btn y-btn-main y-btn-s"
              onClick={calculate}
            >
              完成并应用到量表
            </button>
          )}
          <button
            type="button"
            className="y-btn y-btn-s"
            onClick={resetDefaults}
          >
            恢复示例值
          </button>
        </div>

        {result ? (
          <div className="y-measure-result">
            <div className="y-measure-result-head">
              <b>测量结果</b>
              <Chip tone={confidenceTone}>
                填写质量 {result.label} · {result.confidence}
              </Chip>
            </div>
            <div className="y-measure-breakdown">
              {result.breakdown.map((x) => (
                <div key={x.k}>
                  <span>{x.label}</span>
                  <b>{x.value}</b>
                  <p>{x.text}</p>
                </div>
              ))}
            </div>
            {result.notes.length ? (
              <ul className="y-measure-notes">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
            <p className="y-note">
              分数已写入下方「校准量表」。如果有额外信息，可以再手动微调；微调仅影响本次评估。
              填写质量只反映完整度与一致性，不代表心理测量信度。
            </p>
          </div>
        ) : null}

        <details className="y-measure-formula">
          <summary>分数是怎么算的，以及这种方法能/不能做什么</summary>
          <ul className="y-kv">
            <li>
              <b>经济压力</b>
              <span>40% 支出/收入压力 + 35% 储备月数风险 + 25% 债务还款占比。</span>
            </li>
            <li>
              <b>家庭负担</b>
              <span>35% 赡养/抚养人数 + 30% 每周照护时长 + 15% 经济支柱 + 20% 主观负担。</span>
            </li>
            <li>
              <b>行业周期</b>
              <span>45% 招聘趋势 + 35% 工作稳定性 + 20% 本地岗位密度。</span>
            </li>
            <li>
              <b>认知惯性</b>
              <span>四项探索行为频率的平均值，越高越偏探索型。</span>
            </li>
            <li>
              <b>体验历史</b>
              <span>完整体验学习循环次数 ×22 + 小型验证项目数 ×6，上限 100。</span>
            </li>
            <li>
              <b>边界</b>
              <span>
                这不是经过信效度检验的临床量表，也不做诊断或预测。正式使用前应做认知访谈、重测信度与效度验证；
                权重是透明的工程假设，不是普适常数。
              </span>
            </li>
          </ul>
        </details>
      </div>
    </details>
  );
}
