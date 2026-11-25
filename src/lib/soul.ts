import { DIMS, simBand } from '@/lib/model';
import type { MemoryItem } from '@/lib/memory';
import type { Scores, TaskItem, Victory } from '@/types';

export interface SoulQuestion {
  /** 稳定 key，便于 React 列表与埋点 */
  id: string;
  /** 拷问正文 */
  text: string;
  /** 依据标签：让人知道这句话不是随机生成的 */
  basis: string;
}

interface SoulInput {
  snapshot0: Scores | null;
  current: Scores;
  tasks: TaskItem[];
  victories: Victory[];
  /** 本地长期记忆检索结果（最接近当前处境的旧记录） */
  memories?: MemoryItem[];
}

/** 截断引文，避免整段复盘把卡片撑爆 */
function clip(text: string, max = 42) {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * 规则版「灵魂拷问」。
 *
 * 不调用大模型，只读取用户自己的真实数据：
 * 起点快照、当前七维、任务完成情况、上一轮自省原文。
 * 每条都带「依据」，避免看起来像随机鸡汤。
 */
export function buildSoulQuestions({
  snapshot0,
  current,
  tasks,
  victories,
  memories = [],
}: SoulInput): SoulQuestion[] {
  const out: SoulQuestion[] = [];
  const active = tasks.filter((t) => !t.archived);
  const done = active.filter((t) => t.status === 'done');
  const pending = active.filter((t) => t.status !== 'done');

  /* 1. 经济压力：最接近「资金消耗比预期快」的那条 */
  if (snapshot0) {
    const d = current.econ - snapshot0.econ;
    if (d >= 5) {
      out.push({
        id: 'econ-up',
        basis: `经济压力 ${snapshot0.econ} → ${current.econ}`,
        text: `从起点到现在，你的经济压力从 ${snapshot0.econ} 升到 ${current.econ}。你当初预估的消耗节奏，和实际对得上吗？如果继续这样走，现有余量还能撑几轮？`,
      });
    } else if (d <= -5) {
      out.push({
        id: 'econ-down',
        basis: `经济压力 ${snapshot0.econ} → ${current.econ}`,
        text: `你的经济压力比起点低了 ${Math.abs(d)}。这是真的变轻松了，还是你把某些负担暂时藏起来了？`,
      });
    }
  }

  /* 2. 任务完成率 */
  if (active.length) {
    const rate = Math.round((done.length / active.length) * 100);
    if (pending.length) {
      out.push({
        id: 'tasks-open',
        basis: `本轮 ${done.length}/${active.length} 条完成`,
        text: `这一轮你手上有 ${active.length} 条任务，完成了 ${done.length} 条（${rate}%）。没完成的那 ${pending.length} 条，是路径本身不对，还是节奏没排开？`,
      });
    } else {
      out.push({
        id: 'tasks-done',
        basis: `本轮 ${active.length} 条全部完成`,
        text: `这一轮 ${active.length} 条任务都做完了。完成之后，你是更确定要走这条路，还是发现「做完」不等于「想要」？`,
      });
    }
  }

  /* 3. 体验历史的增长：最容易被忽略的一维 */
  if (snapshot0) {
    const d = current.history - snapshot0.history;
    if (d >= 5) {
      out.push({
        id: 'history-up',
        basis: `体验历史 ${snapshot0.history} → ${current.history}`,
        text: `你的体验历史从 ${snapshot0.history} 涨到 ${current.history}。这些经历是让你更确定方向了，还是让你更犹豫了？如果答案是后者，犹豫出现在哪一维，就写哪一维。`,
      });
    }
  }

  /* 4. 长期记忆：引用与当前处境最接近的那条旧记录 */
  const mem = memories[0];
  if (mem) {
    const band = simBand(mem.sim);
    out.push({
      id: 'memory',
      basis: `历史记忆 · ${
        mem.kind === 'victory'
          ? `第 ${mem.no} 次归档`
          : mem.kind === 'review'
            ? '你的复盘'
            : '你的讨论'
      } · ${mem.when} · 接近度 ${band}`,
      text: `${mem.when}你写过：「${mem.text}」。这次的处境和当时接近度：${band}——那句话现在还成立吗？`,
    });
  } else {
    const latest = victories[victories.length - 1];
    const quote =
      clip(latest?.answers.vision ?? '') || clip(latest?.answers.feel ?? '');
    if (quote) {
      out.push({
        id: 'memory',
        basis: '上一轮的自省原文',
        text: `上一轮你写过：「${quote}」。今天再读一遍，这句话还成立吗？如果不成立，是哪一部分变了？`,
      });
    }
  }

  /* 5. 兜底：没有任何可对比数据时也给一个真问题 */
  if (!out.length) {
    out.push({
      id: 'default',
      basis: victories.length ? `已走过 ${victories.length} 轮闭环` : '还没有可对比的历史',
      text: victories.length
        ? `你已经走过 ${victories.length} 轮闭环。如果把今天当成起点重来一次，你还会选同一条路吗？为什么？`
        : '如果三个月后回头看今天，你最可能后悔「没做」的那件事是什么？',
    });
  }

  return out.slice(0, 3);
}

/** 把最大变化维找出来，供界面做一句概括 */
export function biggestShift(snapshot0: Scores | null, current: Scores) {
  if (!snapshot0) return null;
  let best: { key: string; name: string; delta: number; unit: string } | null = null;
  for (const d of DIMS) {
    const delta = current[d.k] - snapshot0[d.k];
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { key: d.k, name: d.n, delta, unit: d.unit || '' };
    }
  }
  return best && best.delta !== 0 ? best : null;
}
