import type { HistoryItem } from '@/types/history'
import { chinaHistory } from './china'
import { worldHistory } from './world'

export { chinaHistory } from './china'
export { worldHistory } from './world'

/** 全部 340 集：中国历史 170 + 世界历史 170 */
export const allHistory: HistoryItem[] = [...chinaHistory, ...worldHistory]
