import type { City, Direction, StageId } from '@/data/catalog';
import { buildChecklist } from '@/lib/checklist';
import type { Profile } from '@/types';

interface Props {
  dir: Direction;
  profile: Profile;
  city: City;
  stage: StageId;
}

/**
 * 点选方向后的执行清单：要补的技能 / 预算与时间 / 可能踩的坑 / 先做的三件事。
 * 全部由 `buildChecklist` 从现有方向条件与处境推导。
 */
export default function DirectionChecklist({
  dir,
  profile,
  city,
  stage,
}: Props) {
  const c = buildChecklist(dir, profile, city, stage);

  return (
    <section className='y-checklist' aria-label={`「${dir.name}」的执行清单`}>
      <div className='y-checklist-head'>
        <span className='y-checklist-badge'>执行清单</span>
        <span className='y-checklist-sub'>
          由方向条件推导 · 不是承诺，也不替你排序
        </span>
      </div>

      <div className='y-checklist-grid'>
        <div>
          <h5>要补的技能</h5>
          <ul>
            {c.skills.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h5>预算与时间</h5>
          <p>{c.budget}</p>
        </div>
        <div>
          <h5>可能踩的坑</h5>
          <ul>
            {c.risks.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className='y-checklist-moves'>
        <h5>先做这三件事</h5>
        <ol>
          {c.firstMoves.slice(0, 3).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
