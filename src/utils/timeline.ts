import type { HistoryItem, LaidOutNode, Tick } from '@/types/history'

/** 缩放范围：每年对应的像素高度 */
export const MIN_PX_PER_YEAR = 0.02
export const MAX_PX_PER_YEAR = 30

/** 卡片尺寸与布局常量 */
export const CARD_W = 218
export const CARD_H = 64
export const CARD_GAP_X = 14
export const CARD_GAP_Y = 12
/** 节点与主轴之间的水平间隙（轴线到卡片锚点）：需容纳轴侧年份刻度文案，避免卡片遮挡 */
export const AXIS_GAP = 96

/** 没有任何事件的空白区间，在轴上占用的最大像素长度（压缩显示） */
export const EMPTY_CAP = 64
/** 事件密集区间，相邻事件年份之间的最小纵向行距（保证卡片不重叠） */
export const DENSE_MIN = 74

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

/* ===== 年代分段（实色，不用透明度）===== */

/** 年代类型：公元前 / 古代 / 近代 */
export type Era = 'bc' | 'ancient' | 'modern'

/**
 * 三段年代分界年份：
 * - 公元前：year < 1
 * - 古代：1 ≤ year < 1500（公元纪元至地理大发现前夜）
 * - 近代：year ≥ 1500（地理大发现 / 工业文明以降）
 */
export const ERA_BOUNDARY = { ancient: 1, modern: 1500 }

/**
 * 三段年代颜色（与宣纸暖底协调、彼此显著区分）：
 * - 公元前：古铜赭
 * - 古代：朱砂绛红
 * - 近代：黛青墨绿
 */
export const ERA_COLORS: Record<Era, string> = {
  bc: '#9c6b3c',
  ancient: '#b3402f',
  modern: '#3f6b52',
}

/** 节点统一颜色（不区分中外）：墨色圆点，在三段色轴上均显著 */
export const NODE_COLOR = '#3a3128'

/** 根据年份判定所属年代段 */
export function eraOf(year: number): Era {
  if (year < ERA_BOUNDARY.ancient) return 'bc'
  if (year < ERA_BOUNDARY.modern) return 'ancient'
  return 'modern'
}

/**
 * 构造主轴纵向三段渐变（含段间过渡带）。
 * yAncient / yModern 为两个分界年份在内容中的纵向像素坐标；blend 为过渡带半高。
 */
export function axisGradient(yAncient: number, yModern: number, blend = 42): string {
  const c = ERA_COLORS
  return [
    'linear-gradient(to bottom',
    `${c.bc} 0px`,
    `${c.bc} ${Math.max(0, yAncient - blend)}px`,
    `${c.ancient} ${yAncient + blend}px`,
    `${c.ancient} ${Math.max(yAncient + blend, yModern - blend)}px`,
    `${c.modern} ${yModern + blend}px`,
    `${c.modern} 100%)`,
  ].join(',')
}

/** 空白压缩区间 */
export interface Gap {
  /** 区间起止年份（from < to） */
  from: number
  to: number
  /** 区间在内容中的纵向坐标（y0 上，y1 下） */
  y0: number
  y1: number
  /** 是否被压缩（原始长度超过 EMPTY_CAP） */
  compressed: boolean
  /** 是否被拉开（事件过于密集） */
  stretched: boolean
}

/** 事件年份刻度标记 */
export interface YearMark {
  year: number
  y: number
}

/**
 * 非线性时间比例尺：
 * - 有事件的年份按 pxPerYear 正常展开；
 * - 两个相邻事件年份之间若没有任何事件且间隔过大，
 *   压缩为最多 EMPTY_CAP 的一小段（区间内部线性映射）。
 */
export interface ScaleModel {
  yearToY: (year: number) => number
  totalH: number
  gaps: Gap[]
  marks: YearMark[]
}

export function createScale(items: HistoryItem[], pxPerYear: number): ScaleModel {
  const years = [...new Set(items.map((i) => i.year))].sort((a, b) => a - b)

  const marks: YearMark[] = []
  const gaps: Gap[] = []
  let cursor = 0

  years.forEach((year, idx) => {
    if (idx === 0) {
      marks.push({ year, y: 0 })
      return
    }
    const prev = years[idx - 1]
    const delta = year - prev
    const natural = delta * pxPerYear
    // 自适应密度间距：
    // - 稀疏（自然长度过大）→ 压缩为 EMPTY_CAP 短段；
    // - 密集（自然长度过小）→ 拉开到 DENSE_MIN，保证卡片不重叠；
    // - 中间地带按真实年份比例展开。
    const size = natural > EMPTY_CAP ? EMPTY_CAP : Math.max(natural, DENSE_MIN)
    const y0 = cursor
    cursor += size
    gaps.push({
      from: prev,
      to: year,
      y0,
      y1: cursor,
      compressed: natural > EMPTY_CAP,
      stretched: natural < DENSE_MIN,
    })
    marks.push({ year, y: cursor })
  })

  const posOf = (year: number): number => {
    if (years.length === 0) return 0
    if (year <= years[0]) return marks[0].y
    if (year >= years[years.length - 1]) return marks[marks.length - 1].y
    // 定位所在区间并线性插值
    let lo = 0
    let hi = marks.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (years[mid] <= year) lo = mid
      else hi = mid
    }
    const g = gaps[lo]
    const span = g.to - g.from
    const ratio = (year - g.from) / span
    return g.y0 + ratio * (g.y1 - g.y0)
  }

  return { yearToY: posOf, totalH: cursor + 160, gaps, marks }
}

/** 年份区间文案，如「公元200 — 公元500」 */
export function formatRange(from: number, to: number): string {
  const f = from < 0 ? `公元前${-from}` : `公元${from}`
  const t = to < 0 ? `公元前${-to}` : `公元${to}`
  return `${f} — ${t}`
}

/**
 * 节点布局（双侧独立的碰撞检测泳道算法）：
 * 同一侧内纵向冲突的节点自动分配到更远的横向泳道，保证任何缩放下不遮挡；
 * 中国线在主轴左侧，世界线在右侧。
 */
export function layoutNodes(items: HistoryItem[], scale: ScaleModel): LaidOutNode[] {
  const sides: Record<'china' | 'world', HistoryItem[]> = { china: [], world: [] }
  for (const item of items) sides[item.type].push(item)

  const nodes: LaidOutNode[] = []
  const minGap = CARD_H + CARD_GAP_Y

  for (const type of ['china', 'world'] as const) {
    const list = sides[type]
      .map((item) => ({ item, y: scale.yearToY(item.year) }))
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

/** 同期对照：获取与目标年份相差 within 年内的其他分集，按时间升序 */
export function parallelEvents(
  items: HistoryItem[],
  target: HistoryItem,
  within = 50,
): HistoryItem[] {
  return items
    .filter((i) => i.id !== target.id && Math.abs(i.year - target.year) <= within)
    .sort((a, b) => a.year - b.year)
}

/**
 * 根据「事件密度」动态计算同期对照跨度（半径，单位年）：
 *
 * 取距离目标事件最近的若干个其他事件（默认 3 个），以第 3 近事件的年份
 * 距离作为跨度——这样前后 ±跨度 的窗口内恰好能容纳约 3 个同期事件。
 * - 事件密集区（相邻事件年份接近）→ 跨度很小；
 * - 事件稀疏区（事件间隔大）→ 跨度随之放大，但硬上限 1500 年；
 * - minSpan 兜底，避免极端密集时窗口窄到几乎为 0；
 * - 数据不足 3 个时，退化为 maxSpan。
 */
export function parallelSpanByDensity(
  items: HistoryItem[],
  target: HistoryItem,
  densityCount = 3,
  minSpan = 5,
  maxSpan = 1500,
): number {
  const distances = items
    .filter((i) => i.id !== target.id)
    .map((i) => Math.abs(i.year - target.year))
    .sort((a, b) => a - b)

  const anchor = distances[densityCount - 1]
  if (anchor === undefined) return maxSpan
  return Math.round(Math.min(maxSpan, Math.max(minSpan, anchor)))
}

/**
 * 计算节点在时间轴上的进度比例
 * 最早年份→0，最晚年份→1
 */
export function yearProgress(year: number, minYear: number, maxYear: number): number {
  if (maxYear === minYear) return 1
  return (year - minYear) / (maxYear - minYear)
}

/**
 * 根据时间进度计算节点透明度
 * 越早的节点越淡（不低于 minOpacity），越晚的节点越清晰
 */
export function nodeOpacity(progress: number, minOpacity = 0.55): number {
  return minOpacity + (1 - minOpacity) * Math.min(1, Math.max(0, progress))
}

/**
 * 三次贝塞尔曲线路径（节点锚点 -> 面板边缘锚点）
 * 弯曲幅度随两端距离自适应：距离越远弧线越舒展；
 * 两端纵向接近时主动拱起，避免直线贴着/穿过卡片造成遮挡。
 */
export function curvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dir = x2 > x1 ? 1 : -1
  const dx = Math.min(280, Math.max(90, Math.abs(x2 - x1) * 0.55))
  const dy = Math.abs(y2 - y1) < 40 ? 46 : 0
  return `M ${x1} ${y1} C ${x1 + dir * dx} ${y1 - dy}, ${x2 - dir * dx} ${
    y2 - dy
  }, ${x2} ${y2}`
}

/** 兼容类型引用（Tick 仍用于事件年份刻度渲染） */
export type { Tick }
