import { FIELD_CASES } from './catalog';
import { LIVE_FIELD_CASES } from './field-cases-live';

/** 基础六大类 + 快照扩展的八个大类 */
export const ALL_FIELD_CASES = [...FIELD_CASES, ...LIVE_FIELD_CASES];
