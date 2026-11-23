import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import CartLab from '@/components/electrical/CartLab';
import YStarDeltaLab from '@/components/electrical/YStarDeltaLab';
import problem1 from '@/assets/electrical-problem-1.jpg';
import problem2 from '@/assets/electrical-problem-2.jpg';

type Tab = 'q1' | 'q2';

const APP_TITLE = '域途 · 体验式生涯陪伴';

export default function ElectricalLab() {
  const [tab, setTab] = useState<Tab>('q1');

  useEffect(() => {
    document.title = '电气控制 · 交互题解';
    return () => {
      document.title = APP_TITLE;
    };
  }, []);

  return (
    <div id='elab'>
      <div className='elab-bg' aria-hidden='true' />
      <div className='elab-wrap'>
        <header className='elab-head'>
          <div className='elab-head-row'>
            <Link className='elab-back' to='/'>
              <span aria-hidden='true'>←</span> 返回域途
            </Link>
            <span className='elab-kicker'>ELECTRICAL CONTROL · 习题拆解</span>
          </div>
          <h1>
            两道电气控制题，
            <em>做成能动手的电路手册</em>
          </h1>
          <p className='elab-lead'>
            左边是电路，右边是动作。按下启动按钮，看电流沿哪条支路走；把小车推到终端，
            看行程开关怎样把「前进」换成「停留」，再让时间继电器接手。
          </p>
          <div className='elab-meta'>
            <span>
              <i className='is-amber' /> 图 1-39 · 题 1：Y-△ 降压启动
            </span>
            <span>
              <i className='is-cyan' /> 题 2：小车自动往返
            </span>
            <span>
              <i className='is-green' /> 2 min 延时 · 任意位置启停
            </span>
            <span className='elab-mobile-tip'>电路图可左右滑动查看</span>
          </div>
        </header>

        <nav className='elab-tabs' role='tablist' aria-label='题目选择'>
          <button
            type='button'
            role='tab'
            aria-selected={tab === 'q1'}
            className={tab === 'q1' ? 'is-active' : ''}
            onClick={() => setTab('q1')}
          >
            <b>题 1</b>
            <span>Y-△ 降压启动</span>
            <em>分析工作原理</em>
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={tab === 'q2'}
            className={tab === 'q2' ? 'is-active' : ''}
            onClick={() => setTab('q2')}
          >
            <b>题 2</b>
            <span>小车自动往返</span>
            <em>设计控制电路</em>
          </button>
        </nav>

        <main className='elab-main'>
          {tab === 'q1' ? (
            <YStarDeltaLab photo={problem1} />
          ) : (
            <CartLab photo={problem2} />
          )}
        </main>

        <footer className='elab-foot'>
          <p>
            题图来源：用户上传的教材照片（图 1-39 题 1 图 / 题 2）。电路按教材逻辑重绘，
            符号做示意化处理；延时时间在演示中已压缩，实际整定值以工艺要求为准。
          </p>
          <Link to='/'>← 回到域途</Link>
        </footer>
      </div>
    </div>
  );
}
