import type { HistoryItem, LaidOutNode, Tick } from '@/types/history'

/** 时间轴覆盖的年份范围（含史前旧石器时代） */
export const MIN_YEAR = -300000
export const MAX_YEAR = 2000

/** 缩放范围：每年对应的像素高度 */
export const MIN_PX_PER_YEAR = 0.02
export const MAX_PX_PER_YEAR = 30

/** 卡片尺寸与布局常量 */
export const CARD_W = 218
export const CARD_H = 64
export const CARD_GAP_X = 14
export const CARD_GAP_Y = 12
/** 节点与主轴之间的水平间隙（轴线到卡片锚点） */
export const AXIS_GAP = 26

/**
 * 年份 -> 纵向像素坐标
 * 注意：不存在「公元0年」，公元前1年的下一年即公元1年。
 */
export function yearToY(year: number, pxPerYear: number): number {
  const continuous = year <= 0 ? year + 1 : year
  const minContinuous = MIN_YEAR + 1
  return (continuous - minContinuous) * pxPerYear
}

/** 纵向像素坐标 -> 年份 */
export function yToYear(y: number, pxPerYear: number): number {
  const minContinuous = MIN_YEAR + 1
  const continuous = Math.round(minContinuous + y / pxPerYear)
  return continuous <= 0 ? continuous - 1 : continuous
}

/** 时间轴内容总高度 */
export function totalHeight(pxPerYear: number): number {
  return yearToY(MAX_YEAR, pxPerYear)
}

/** 年份格式化：BC 公元前 / AD 公元后 */
export function formatYear(year: number): string {
  if (year < 0) return `公元前 ${-year} 年`
  if (year === 0) return '公元前 1 年'
  return `公元 ${year} 年`
}

/** 短年份标签（用于刻度） */
export function shortYear(year: number): string {
  if (year < 0) return `前${-year}`
  if (year === 0) return '前1'
  return `${year}`
}

/** 自适应刻度间隔（年），保证主刻度间距约 90~180px */
const NICE_STEPS = [
  1, 2, 5, 10, 20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000,
  100000,
]

export function pickStep(pxPerYear: number): number {
  const target = 110 / pxPerYear
  for (const step of NICE_STEPS) {
    if (step >= target) return step
  }
  return NICE_STEPS[NICE_STEPS.length - 1]
}

/**
 * 生成可视区内的刻度
 * @param y0 可视区顶部内容坐标
 * @param y1 可视区底部内容坐标
 */
export function buildTicks(y0: number, y1: number, pxPerYear: number): Tick[] {
  const step = pickStep(pxPerYear)
  const yearStart = yToYear(y0, pxPerYear)
  const yearEnd = yToYear(y1, pxPerYear)
  const ticks: Tick[] = []
  const first = Math.ceil((yearStart - 1) / step) * step
  for (let year = first; year <= yearEnd; year += step) {
    ticks.push({ year, y: yearToY(year, pxPerYear), major: true })
  }
  return ticks
}

/**
 * 节点布局（双侧独立的碰撞检测泳道算法）：
 * 1. 节点先按年份换算纵向坐标；
 * 2. 同一侧内，若与已有泳道中的节点纵向冲突（卡片会重叠），
 *    则分配到更远的横向泳道，保证任何缩放下节点都不互相遮挡；
 * 3. 同年节点自然落入不同泳道，实现横向并列；
 * 4. 中国线在主轴左侧，世界线在右侧。
 */
export function layoutNodes(items: HistoryItem[], pxPerYear: number): LaidOutNode[] {
  const sides: Record<'china' | 'world', HistoryItem[]> = { china: [], world: [] }
  for (const item of items) sides[item.type].push(item)

  const nodes: LaidOutNode[] = []
  const minGap = CARD_H + CARD_GAP_Y

  for (const type of ['china', 'world'] as const) {
    const list = sides[type]
      .map((item) => ({ item, y: yearToY(item.year, pxPerYear) }))
      .sort((a, b) => a.y - b.y || a.item.episode - b.item.episode)

    /** 每条泳道最后一个节点占据的底部 y */
    const laneBottoms: number[] = []

    for (const { item, y } of list) {
      let lane = laneBottoms.findIndex((bottom) => bottom <= y)
      if (lane === -1) {
        lane = laneBottoms.length
        laneBottoms.push(-Infinity)
      }
      laneBottoms[lane] = y + minGap

      nodes.push({
        item,
        y,
        lane,
        x:
          type === 'china'
            ? -(AXIS_GAP + lane * (CARD_W + CARD_GAP_X) + CARD_W)
            : AXIS_GAP + lane * (CARD_W + CARD_GAP_X),
      })
    }
  }
  return nodes
}

/**
 * 虚拟滚动：按可视窗口过滤节点（含缓冲区）
 */
export function visibleNodes(
  nodes: LaidOutNode[],
  y0: number,
  y1: number,
  buffer = 500,
): LaidOutNode[] {
  return nodes.filter((n) => n.y + CARD_H >= y0 - buffer && n.y <= y1 + buffer)
}

/** 同期对照：获取与目标年份相差 within 年内的其他分集 */
export function parallelEvents(
  items: HistoryItem[],
  target: HistoryItem,
  within = 50,
): HistoryItem[] {
  return items
    .filter((i) => i.id !== target.id && Math.abs(i.year - target.year) <= within)
    .sort((a, b) => Math.abs(a.year - target.year) - Math.abs(b.year - target.year))
}

/** 三次贝塞尔曲线路径（节点锚点 -> 面板边缘锚点） */
export function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.5)
  return `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${
    x2 + (x2 > x1 ? -dx : dx)
  } ${y2}, ${x2} ${y2}`
}
