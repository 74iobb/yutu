import type { ReactNode } from 'react';

export interface ChartLegendItem {
  label: string;
  color: string;
  shape?: 'dot' | 'line' | 'dash';
}

interface Props {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  legend?: ChartLegendItem[];
  children: ReactNode;
  foot?: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * 图表统一外壳：标题 / 副标题 / 操作 / 图例 / 空态 / 加载 / 脚注。
 * 使用设计令牌与「主卡」层级，不绑定具体图表实现。
 */
export default function ChartFrame({
  eyebrow,
  title,
  subtitle,
  actions,
  legend,
  children,
  foot,
  empty,
  loading = false,
  className = '',
  bodyClassName = '',
}: Props) {
  return (
    <section
      className={`y-card y-chart-frame${className ? ` ${className}` : ''}`}
      aria-label={typeof title === 'string' ? title : undefined}
    >
      <div className='y-chart-head'>
        <div className='y-chart-title'>
          {eyebrow ? <p className='y-eyebrow'>{eyebrow}</p> : null}
          <h3>{title}</h3>
          {subtitle ? <p className='y-chart-sub'>{subtitle}</p> : null}
        </div>
        {actions ? <div className='y-chart-actions'>{actions}</div> : null}
      </div>

      {legend?.length ? (
        <ul className='y-chart-legend'>
          {legend.map(item => (
            <li key={item.label}>
              <i
                className={`is-${item.shape ?? 'dot'}`}
                style={{ color: item.color, background: item.color }}
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className={`y-chart-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>
        {loading ? (
          <div className='y-chart-skeleton' aria-label='图表加载中'>
            <i />
            <i />
            <i />
          </div>
        ) : empty ? (
          <div className='y-chart-empty'>{empty}</div>
        ) : (
          children
        )}
      </div>

      {foot ? <div className='y-chart-foot'>{foot}</div> : null}
    </section>
  );
}
