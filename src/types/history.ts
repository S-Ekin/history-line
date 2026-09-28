/**
 * 双线历史时间轴核心数据模型
 */

/** 历史线类型：中国历史 / 世界历史 */
export type HistoryType = 'china' | 'world'

/** 关键事件 */
export interface KeyEvent {
  /** 事件名称，如「商鞅变法」 */
  eventName: string
  /** 核心人物，多个用顿号分隔，如「商鞅、秦孝公」 */
  figures: string
  /** 事件简述 */
  desc: string
}

/** 历史分集节点 */
export interface HistoryItem {
  /** 唯一 id，中国线 c-{ep}，世界线 w-{ep} */
  id: string
  /** 分集标题 */
  title: string
  /**
   * 绑定年份（整数）：
   * 公元前为负数（如 -221 = 公元前221年），
   * 公元后为正数（如 1912 = 公元1912年）
   */
  year: number
  /** 所属历史线 */
  type: HistoryType
  /** 集数（1-100） */
  episode: number
  /** 关键事件与核心人物 */
  keyEvents: KeyEvent[]
}

/** 显示模式：只看中国 / 只看世界 / 双线对照 */
export type DisplayMode = 'china' | 'world' | 'both'

/** 经过布局计算后的节点（携带渲染坐标） */
export interface LaidOutNode {
  item: HistoryItem
  /** 距离时间轴内容顶部的纵向像素位置 */
  y: number
  /** 横向像素位置（卡片靠近轴线一侧的锚点 x） */
  x: number
  /** 同年并列时的泳道序号，0 最靠近主轴 */
  lane: number
}

/** 时间刻度 */
export interface Tick {
  year: number
  y: number
  /** 是否主刻度（带年份标签） */
  major: boolean
}
