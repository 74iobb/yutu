import { ASSETS, CITY_MAP, URBAN_LABEL, type Stage } from '@/data/catalog';
import { SNAPSHOT_AT } from '@/data/snapshot-meta';
import type { PrototypeNode } from '@/types';
import {
  assetLevel,
  CHOICE_LABEL,
  currentStage,
  DIMS,
  FEAS_LABEL,
  feasibility,
  ranked,
  similarityBreakdown,
  simBand,
  stabilityOf,
  stageDirections,
} from './model';
import type { YutuState } from '@/store/YutuContext';

export function buildSummaryMarkdown(state: YutuState, nodes: PrototypeNode[]): string {
  const p = state.profile;
  const city = CITY_MAP[p.city];
  const stage: Stage = currentStage(p);
  const rank = ranked(p.s, nodes);
  const top = rank[0];
  const stab = stabilityOf(p.s, nodes);
  const why = top ? similarityBreakdown(p.s, top.node).slice(0, 3) : [];
  const dirs = stageDirections(stage.id).map((d) => ({ dir: d, f: feasibility(d, p) }));
  const short = state.shortlist
    .map((name) => dirs.find((x) => x.dir.name === name))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const last = state.victories[state.victories.length - 1];

  const lines: string[] = [
    '# 域途 · 一页纸',
    '',
    `> 生成于 ${new Date().toLocaleString('zh-CN')} ｜ 知乎内容快照 ${SNAPSHOT_AT}`,
    '',
    '## 我的处境',
    '',
    `- 城市：${city?.name ?? p.city}（${city?.province ?? '未归省'} · ${city?.tier ?? '—'} · ${URBAN_LABEL[p.urban]?.n ?? p.urban}）`,
    `- 年龄：${p.s.age} 岁 ｜ 身份：${p.identity === 'work' ? '已工作' : '在校/待业'}`,
    `- 方向：${p.field || '未填写'}`,
    `- 阶段：${stage.name}`,
    `- 七维：${DIMS.map((d) => `${d.n} ${p.s[d.k]}${d.unit || ''}`).join('，')}`,
    '',
    '## 归属',
    '',
    top
      ? `- 归属域：${top.node.name}`
      : '- 归属域：暂缺',
    top ? `- 接近度：${simBand(top.sim)} ｜ 稳定度：${stab.label}` : '',
    why.length ? `- 主要来自：${why.map((x) => x.n).join('、')}` : '',
    '',
    '## 方向候选',
    '',
    ...(short.length
      ? short.map(
          ({ dir, f }) =>
            `- [${FEAS_LABEL[f.level].t}] ${dir.name} — 前置：${dir.prereq}`
        )
      : ['- 尚未加入候选；可在第三步的方向卡片加入。']),
    '',
    '## 一次性资源',
    '',
    ...ASSETS.map((a) => {
      const lv = assetLevel(a, p);
      return `- ${a.name}：${lv.label} — ${lv.why}`;
    }),
    '',
    '## 闭环',
    '',
    `- 阶段性胜利：${state.victories.length} 次`,
    last
      ? `- 最近一次：第 ${last.no} 次 · ${CHOICE_LABEL[last.choice]} ｜ 归属 ${last.domain}`
      : '- 最近一次：暂无',
    '',
    '## 边界',
    '',
    '- 归属只比较方向与强度，不预测结果。',
    '- 去向分布为演示数据；案例与近期讨论为知乎检索快照，不是实时结果。',
    '',
  ];
  return lines.filter((l) => l !== null).join('\n');
}

/**
 * 完整个人备份：档案、任务、胜利、自己提交的复盘、标记记录与本地 UI 状态。
 * 完全在浏览器本地生成，不上传；也不包含他人复盘正文之外的个人信息。
 */
export function buildBackupJson(
  state: YutuState,
  ownerKey: string,
  markedIds: string[]
): string {
  return JSON.stringify(
    {
      app: '域途',
      format: 'yutu-backup-v1',
      exportedAt: new Date().toISOString(),
      ownerKey,
      profile: state.profile,
      tasks: state.tasks,
      victories: state.victories,
      myReviews: state.reviews.filter((r) => r.authorKey === ownerKey),
      markCounts: state.markCounts,
      markedIds,
      shortlist: state.shortlist,
      step: state.step,
      maxStep: state.maxStep,
      dataSource: state.backendOnline ? 'platform' : 'local',
    },
    null,
    2
  );
}

export function downloadText(filename: string, text: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
