import type { HistoryItem } from '@/types/history'
import { chinaHistory } from './china'
import { worldHistory } from './world'

export { chinaHistory } from './china'
export { worldHistory } from './world'

/** 全部 200 集：中国历史 100 + 世界历史 100 */
export const allHistory: HistoryItem[] = [...chinaHistory, ...worldHistory]
