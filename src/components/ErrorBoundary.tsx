import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** 兜底错误边界：单个视图异常不再导致整页白屏 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 保留到控制台，便于定位；不把堆栈渲染给用户
    console.error('[yutu] view error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="y-fatal" role="alert">
        <h3>这一页暂时没有加载出来</h3>
        <p>{this.state.error.message || '未知错误'}</p>
        <div className="y-row">
          <button type="button" className="y-btn y-btn-main" onClick={() => window.location.reload()}>
            重新加载
          </button>
          <button
            type="button"
            className="y-btn"
            onClick={() => this.setState({ error: null })}
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }
}
