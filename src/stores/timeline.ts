import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { DisplayMode, HistoryItem } from '@/types/history'
import { allHistory } from '@/data'
import { MAX_PX_PER_YEAR, MIN_PX_PER_YEAR } from '@/utils/timeline'

export const useTimelineStore = defineStore('timeline', () => {
  /** 显示模式 */
  const displayMode = ref<DisplayMode>('both')
  /** 缩放：每年像素数 */
  const pxPerYear = ref(1.5)
  /** 当前选中的分集 */
  const selected = ref<HistoryItem | null>(null)
  /** 详情面板位置（相对视口，左上角） */
  const panelPos = ref({ x: 0, y: 120 })
  /** 搜索关键字（年份或标题） */
  const keyword = ref('')
  /** 时间轴视口状态（由滚动容器同步，供详情面板绘制连接线） */
  const scrollTop = ref(0)
  const scrollLeftX = ref(0)
  const centerX = ref(0)

  function setViewport(top: number, cx: number, left = 0) {
    scrollTop.value = top
    centerX.value = cx
    scrollLeftX.value = left
  }

  /** 按显示模式过滤后的全部数据 */
  const filteredItems = computed<HistoryItem[]>(() => {
    if (displayMode.value === 'both') return allHistory
    return allHistory.filter((i) => i.type === displayMode.value)
  })

  /** 搜索结果（年份精确 / 标题模糊） */
  const searchResults = computed<HistoryItem[]>(() => {
    const kw = keyword.value.trim()
    if (!kw) return []
    const asYear = Number(kw)
    return allHistory
      .filter((i) => {
        if (Number.isFinite(asYear) && kw !== '') {
          const y = asYear > 0 ? asYear : -asYear
          if (Math.abs(i.year) === y) return true
        }
        return i.title.includes(kw) || i.keyEvents.some((e) => e.eventName.includes(kw))
      })
      .slice(0, 8)
  })

  function setDisplayMode(mode: DisplayMode) {
    displayMode.value = mode
  }

  function zoom(factor: number) {
    pxPerYear.value = Math.min(
      MAX_PX_PER_YEAR,
      Math.max(MIN_PX_PER_YEAR, pxPerYear.value * factor),
    )
  }

  function select(item: HistoryItem | null, viewportW = window.innerWidth) {
    selected.value = item
    if (item) {
      // 详情面板宽度（与 DetailPanel 的 w-386px 保持一致）
      const PANEL_W = 386
      const margin = 20
      // 时间轴主轴位于视口水平中心：节点在轴的哪一侧，面板就放到对侧半屏，
      // 避免遮挡节点所在一侧的内容。
      // 中国线节点在左 → 面板落在右半屏；世界线节点在右 → 面板落在左半屏。
      const isLeftSideNode = item.type === 'china'
      const preferred = isLeftSideNode
        ? viewportW / 2 + 40
        : viewportW / 2 - PANEL_W - 40
      // 兜底：保证面板整体留在视口内（窄屏时退化为贴边显示）
      const x = Math.min(
        viewportW - PANEL_W - margin,
        Math.max(margin, preferred),
      )
      panelPos.value = { x: Math.round(x), y: 160 }
    }
  }

  function movePanel(x: number, y: number) {
    panelPos.value = { x, y }
  }

  return {
    displayMode,
    pxPerYear,
    selected,
    panelPos,
    keyword,
    scrollTop,
    scrollLeftX,
    centerX,
    filteredItems,
    searchResults,
    setDisplayMode,
    setViewport,
    zoom,
    select,
    movePanel,
  }
})
