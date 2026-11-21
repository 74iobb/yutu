/**
 * 第 3 步内部视图的跨步记忆。
 * 第 3 步（方向清单 / 资源作战图 / 归属与摘要）在切步时会被卸载，
 * 用 sessionStorage 记住最后视图；从闭环点「回看落点」时强制打开归属摘要。
 */
export type Step34View = 'list' | 'map' | 'summary';

const KEY = 'yutu.view34';

export function readStep34View(): Step34View {
  try {
    const v = sessionStorage.getItem(KEY);
    return v === 'map' || v === 'summary' ? v : 'list';
  } catch {
    return 'list';
  }
}

export function openStep34(view: Step34View) {
  try {
    sessionStorage.setItem(KEY, view);
  } catch {
    /* 会话存储不可用时只影响视图记忆 */
  }
}
