import { useEffect, useMemo, useState } from 'react';
import { ASSETS } from '@/data/catalog';
import { assetLevel, currentStage, simBand, stabilityOf } from '@/lib/model';
import { useYutu } from '@/store/YutuContext';
import { Mascot } from './bits';

const STEP_PROMPTS: Record<number, string[]> = {
  1: [
    '不用一次填得很准。拿不准的题，选中间也是有效信息。',
    '结构化测量比单个滑块更可靠，但它仍然只是自评，不是诊断。',
    '先填事实，再看系统给你的阶段；阶段不是标签，只是起点。',
  ],
  2: [
    '先看看你所处的城市和区域里有哪些真实讨论，不急着比较。',
    '城市层面的真实讨论更适合拿来校准；不用急着和别人比较。',
    '蓝圈只是你附近的一片区域，不代表你必须留在这里。',
  ],
  3: [
    '方向没有高低，只有代价不同。',
    '先看前置条件，再看你想不想走；可行性不是对你的评价。',
    '把感兴趣的方向加入候选，切到同一步的资源作战图并排看代价。',
    '这里不设主攻目标，也不给成功率。阻力来自条件，不是来自人。',
    '先看一次性资源：哪些用掉就不可逆、哪些正在关闭。',
    '归属是用来理解结构的，不是给你下结论。',
    '稳定度低的时候，把接近度档位当作参考，不要当作答案。',
  ],
  4: [
    '任务可以增删改；停靠、暂时搁置、放弃都是合法选择。',
    '驿站不做成败判定。写不完整也没关系，真实比工整重要。',
    '阶段性胜利不需要宏大；完整走通一轮最小体验就算。',
  ],
};

function shortName(name: string) {
  return name.split(' · ')[0];
}

export default function Companion() {
  const { state, currentRank, nodes } = useYutu();
  const [open, setOpen] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [answer, setAnswer] = useState<{ q: string; a: string } | null>(null);
  useEffect(() => {
    setPromptIndex(0);
    setAnswer(null);
  }, [state.step]);

  /* 头部品牌标识上的吉祥物点击后从这里打开陪谈 */
  useEffect(() => {
    const toggle = () => setOpen(o => !o);
    window.addEventListener('yutu:companion', toggle);
    return () => window.removeEventListener('yutu:companion', toggle);
  }, []);

  const stage = currentStage(state.profile);
  const prompts = STEP_PROMPTS[state.step] ?? STEP_PROMPTS[1];
  const prompt = prompts[promptIndex % prompts.length];

  const answers = useMemo(() => {
    const top = currentRank()[0];
    const stab = stabilityOf(state.profile.s, nodes);
    const doing = state.tasks.filter((t) => t.status === 'doing').length;
    const done = state.tasks.filter((t) => t.status === 'done' && !t.archived).length;
    const victories = state.victories.length;

    const next = (() => {
      if (!state.tasks.length) {
        return `你在「${stage.name}」。可以先去第三步看方向，或在第四步工作台载入一条本域参考任务。先做一件最小的事。`;
      }
      if (done) {
        return `有 ${done} 段体验已标记完成。去驿站停靠，写下真实感受；归档后位置会小幅漂移，不需要写得很完整。`;
      }
      if (doing) {
        return `你有 ${doing} 项进行中。先完成最小的一条就好，不需要同时推进全部。`;
      }
      if (victories) {
        return `已累计 ${victories} 次阶段性胜利。可以回第二步看落点变化，也可以选择暂时休整。`;
      }
      return '闭环从一条小任务开始。不用先想清楚全部，先走一小步。';
    })();

    const reliability = top
      ? `当前最接近「${shortName(top.node.name)}」，接近度 ${simBand(
          top.sim
        )}，稳定度 ${stab.label}。${stab.note} 归属只表示方向接近，不预测结果。`
      : '目前还没有可比较的环境域。先完成第一步的信息填写。';

    const choose = state.shortlist.length
      ? `你的候选是：${state.shortlist.join('、')}。先比较它们消耗的一次性资源，再看哪条前置条件最少；不要只看听起来好不好。`
      : '先加入 2–4 条候选，再切到同一步的资源作战图并排看代价。候选不是承诺，随时可以移除。';

    const resourceSummary = ASSETS.map((a) => {
      const lv = assetLevel(a, state.profile);
      return `${a.name}：${lv.label}`;
    }).join('；');

    return [
      { q: '我现在最该做什么？', a: next },
      { q: '这个归属可靠吗？', a: reliability },
      { q: '我可以停下来吗？', a: '可以。系统没有连续打卡、排行榜和逾期提醒。你可以在驿站选择「暂时休整」并归档；休息也是闭环的一部分，不会影响你的分数或排名。' },
      { q: '方向太多，怎么选？', a: choose },
      { q: '系统会给我打分吗？', a: '不会。系统不设排名、不打分、不预测成功率。它只呈现你填写的处境、方向代价与相似度，选择权在你。' },
      { q: '我手上有哪些一次性资源？', a: `当前：${resourceSummary}。用掉或过期都不可逆，去资源作战图看每个方向会消耗哪一项。` },
    ];
  }, [currentRank, nodes, stage.name, state.profile, state.shortlist, state.tasks, state.victories]);

  return (
    <div className="y-companion">
      {open ? (
        <div className="y-companion-panel" role="dialog" aria-label="陪伴角色刘看山">
          <div className="y-companion-head">
            <Mascot />
            <div>
              <b>刘看山</b>
              <span>陪你走一段 · 不做评判</span>
            </div>
            <button
              type="button"
              className="y-companion-close"
              aria-label="收起陪谈"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </div>
          <p className="y-companion-speech" aria-live="polite">
            {prompt}
          </p>
          <div className="y-companion-questions">
            {answers.map((item) => (
              <button
                key={item.q}
                type="button"
                onClick={() => setAnswer(item)}
                className={answer?.q === item.q ? 'is-on' : ''}
              >
                {item.q}
              </button>
            ))}
          </div>
          {answer ? (
            <div className="y-companion-answer" aria-live="polite">
              <b>{answer.q}</b>
              <p>{answer.a}</p>
            </div>
          ) : null}
          <div className="y-companion-foot">
            <button
              type="button"
              className="y-btn y-btn-s"
              onClick={() => {
                setPromptIndex((i) => (i + 1) % prompts.length);
                setAnswer(null);
              }}
            >
              换一段话
            </button>
            <span>只基于你当前填写的内容</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
