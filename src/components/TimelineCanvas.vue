<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import TimelineNode from './TimelineNode.vue'
import { allHistory } from '@/data'
import {
  createScale,
  formatRange,
  layoutNodes,
  visibleNodes,
  CARD_W,
  yearProgress,
  nodeOpacity,
} from '@/utils/timeline'

const store = useTimelineStore()

const scrollEl = ref<HTMLElement | null>(null)
const viewportH = ref(window.innerHeight)
const viewportW = ref(window.innerWidth)
const top = ref(0)
let raf = 0

/** 非线性比例尺（始终基于全量数据，保证不同显示模式下刻度一致） */
const scale = computed(() => createScale(allHistory, store.pxPerYear))

/** 全部节点布局（按显示模式过滤，但坐标由统一 scale 定位） */
const allNodes = computed(() => layoutNodes(store.filteredItems, scale.value))

/** 虚拟滚动：仅渲染可视区节点 */
const nodes = computed(() =>
  visibleNodes(allNodes.value, top.value, top.value + viewportH.value + 80),
)

/** 可视区内的事件年份刻度 */
const marks = computed(() =>
  scale.value.marks.filter((m) => m.y >= top.value - 80 && m.y <= top.value + viewportH.value + 80),
)

/** 可视区内的空白压缩区间 */
const gaps = computed(() =>
  scale.value.gaps.filter(
    (g) => g.compressed && g.y1 >= top.value - 80 && g.y0 <= top.value + viewportH.value + 80,
  ),
)

const contentH = computed(() => scale.value.totalH)

/** 当前过滤后的年份范围（用于颜色渐变） */
const yearRange = computed(() => {
  const years = store.filteredItems.map((i) => i.year)
  return { min: Math.min(...years), max: Math.max(...years) }
})

/** 计算节点透明度（越早越淡，最小 0.55） */
function computeOpacity(year: number): number {
  const { min, max } = yearRange.value
  return nodeOpacity(yearProgress(year, min, max))
}

/** 内容所需的单侧宽度（容纳最远泳道卡片），不足视口时以视口为准 */
const halfSpan = computed(() => {
  let maxExtent = 0
  for (const n of allNodes.value) {
    const extent = n.item.type === 'world' ? n.x + CARD_W : -n.x
    if (extent > maxExtent) maxExtent = extent
  }
  return Math.max(viewportW.value / 2, maxExtent + 48)
})
const contentW = computed(() => halfSpan.value * 2)
/** 主轴位于内容横向中心 */
const centerX = computed(() => halfSpan.value)

function centerHorizontally() {
  if (scrollEl.value)
    scrollEl.value.scrollLeft = (contentW.value - viewportW.value) / 2
}

function syncViewport() {
  raf = 0
  if (!scrollEl.value) return
  top.value = scrollEl.value.scrollTop
  store.setViewport(top.value, centerX.value, scrollEl.value.scrollLeft)
}

function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(syncViewport)
}

function onResize() {
  viewportH.value = window.innerHeight
  viewportW.value = window.innerWidth
  centerHorizontally()
  syncViewport()
}

/** Ctrl + 滚轮：以鼠标位置为锚点缩放 */
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const el = scrollEl.value!
  const oldPx = store.pxPerYear
  const cursorY = e.offsetY
  const oldScale = scale.value
  // 记录鼠标位置对应的年份
  let anchorYear = oldScale.marks[0]?.year ?? 0
  const gs = oldScale.gaps
  for (const g of gs) {
    const sy = top.value + cursorY
    if (sy >= g.y0 && sy <= g.y1) {
      const ratio = (sy - g.y0) / (g.y1 - g.y0 || 1)
      anchorYear = Math.round(g.from + ratio * (g.to - g.from))
      break
    }
  }
  store.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)
  if (oldPx !== store.pxPerYear) {
    nextTick(() => {
      const ns = scale.value
      el.scrollTop = ns.yearToY(anchorYear) - cursorY
      syncViewport()
    })
  }
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  // 初始定位到文明早期（公元前 3500 年附近）
  setTimeout(() => {
    if (scrollEl.value) {
      centerHorizontally()
      scrollEl.value.scrollTop = scale.value.yearToY(-3500) - viewportH.value / 3
      syncViewport()
    }
  }, 350)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div
    ref="scrollEl"
    class="tl-scroll absolute inset-0 top-56px overflow-auto"
    @scroll="onScroll"
    @wheel="onWheel"
  >
    <!-- 虚拟滚动占位：撑开完整时间轴高度（横向超出时可横向滚动） -->
    <div class="relative" :style="{ height: `${contentH}px`, width: `${contentW}px` }">
      <!-- 主时间轴线（加粗） -->
      <div
        class="absolute top-0 bottom-0 w-6px rounded-full bg-gradient-to-b from-transparent via-bronze-deep to-transparent"
        :style="{ left: `${centerX - 3}px` }"
      />

      <!-- 事件年份刻度 -->
      <template v-for="mark in marks" :key="mark.year">
        <div
          class="absolute h-12px w-12px rounded-full bg-gold border-2 border-bronze-deep"
          :style="{ top: `${mark.y - 4}px`, left: `${centerX - 6}px` }"
        />
        <!-- 右侧刻度：单一数据源，避免左右标签混淆 -->
        <div
          class="absolute whitespace-nowrap text-11px leading-12px text-ink-light select-none"
          :style="{ top: `${mark.y - 6}px`, left: `${centerX + 14}px` }"
        >
          {{ mark.year < 0 ? `公元前${-mark.year}` : mark.year === 0 ? `公元元年` : `公元${mark.year}` }}
        </div>
      </template>

      <!-- 空白压缩区间：一小段 + 区间文案 -->
      <template v-for="g in gaps" :key="`gap-${g.from}-${g.to}`">
        <div
          class="absolute z-1 flex items-center justify-center"
          :style="{ top: `${g.y0}px`, height: `${g.y1 - g.y0}px`, left: `${centerX - 95}px`, width: '190px' }"
        >
          <span
            class="block whitespace-nowrap text-9px leading-none text-center text-bronze-deep bg-paper/95 border border-bronze/40 rounded px-8px py-4px"
          >
            {{ formatRange(g.from, g.to) }}
          </span>
        </div>
      </template>

      <!-- 公元元年纪元分界标记 -->
      <div
        v-if="scale.marks.some((m) => m.year >= 1)"
        class="absolute z-1 flex items-center"
        :style="{ top: `${scale.yearToY(1) - 12}px`, left: `${centerX - 60}px` }"
      >
        <span
          class="w-120px text-center text-11px tracking-3px text-bronze-deep border-y border-bronze/50 py-2px bg-paper/80"
        >
          公元纪元
        </span>
      </div>

      <!-- 节点（仅可视区） -->
      <TimelineNode
        v-for="node in nodes"
        :key="node.item.id"
        :node="node"
        :center-x="centerX"
        :opacity="computeOpacity(node.item.year)"
      />
    </div>
  </div>
</template>
