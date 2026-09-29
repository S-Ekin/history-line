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
      // 默认面板出现在与节点相反的一侧，避免遮挡
      const fromLeft = item.type === 'china'
      panelPos.value = {
        x: fromLeft ? Math.round(viewportW * 0.42) : Math.round(viewportW * 0.08),
        y: 160,
      }
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
