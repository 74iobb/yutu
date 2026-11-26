/**
 * 第 3 步内部视图的跳转约定。
 * 进入「方向与推演」时**永远先落在方向清单**，之后由用户自己切换；
 * 只有显式跨步跳转（如闭环里的「回看落点」）才指定一次目标视图，
 * 这次指定在进入时消费掉，不会成为下次进入的默认值。
 */
export type Step34View = 'list' | 'map' | 'summary';

const KEY = 'yutu.view34';

/** 读取并清空一次性指定的视图；没有指定时返回方向清单 */
export function consumeStep34View(): Step34View {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return v === 'map' || v === 'summary' ? v : 'list';
  } catch {
    return 'list';
  }
}

/** 跨步跳转前指定进入第 3 步时要打开的视图（只生效一次） */
export function openStep34(view: Step34View) {
  try {
    sessionStorage.setItem(KEY, view);
  } catch {
    /* 会话存储不可用时退化为默认的方向清单 */
  }
}
