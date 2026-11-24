import { useMemo } from 'react';
import { retrieveMemories } from '@/lib/memory';
import { biggestShift, buildSoulQuestions } from '@/lib/soul';
import type {
  Discussion,
  Review,
  Scores,
  TaskItem,
  Victory,
} from '@/types';

interface SoulCardProps {
  snapshot0: Scores | null;
  current: Scores;
  tasks: TaskItem[];
  victories: Victory[];
  reviews: Review[];
  discussions: Discussion[];
  ownerKey: string;
  /** 只显示前两个问题（用于空间紧张的卡片） */
  compact?: boolean;
}

/**
 * 归档前的「灵魂拷问」卡。
 * 问题由 `buildSoulQuestions` 从真实数据生成，每条都标注依据。
 */
export default function SoulCard({
  snapshot0,
  current,
  tasks,
  victories,
  reviews,
  discussions,
  ownerKey,
  compact = false,
}: SoulCardProps) {
  const memories = useMemo(
    () =>
      retrieveMemories(
        current,
        victories,
        reviews,
        discussions,
        ownerKey
      ),
    [current, victories, reviews, discussions, ownerKey]
  );
  const questions = useMemo(
    () =>
      buildSoulQuestions({
        snapshot0,
        current,
        tasks,
        victories,
        memories,
      }),
    [snapshot0, current, tasks, victories, memories]
  );
  const list = compact ? questions.slice(0, 2) : questions;
  const shift = useMemo(() => biggestShift(snapshot0, current), [snapshot0, current]);

  return (
    <section className='y-soul' aria-label='灵魂拷问'>
      <div className='y-soul-head'>
        <span className='y-soul-badge'>灵魂拷问</span>
        <span className='y-soul-sub'>
          {shift
            ? `最大变化：${shift.name} ${shift.delta > 0 ? '+' : ''}${shift.delta}${shift.unit}`
            : '问题来自你自己的数据，不是随机文案'}
          {memories.length ? ` · 记忆 ${memories.length} 条` : ''}
        </span>
      </div>
      <ol className='y-soul-list'>
        {list.map((q, i) => (
          <li key={q.id}>
            <span className='y-soul-no' aria-hidden='true'>
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <p>{q.text}</p>
              <em className='y-soul-basis'>依据：{q.basis}</em>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
