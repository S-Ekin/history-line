<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import TimelineNode from './TimelineNode.vue'
import { allHistory } from '@/data'
import {
  createScale,
  layoutNodes,
  visibleNodes,
  CARD_W,
  axisGradient,
  ERA_COLORS,
  eraOf,
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

/** 主轴纵向三段年代渐变（公元前古铜 / 古代绛红 / 近代黛绿，段间过渡） */
const axisStyle = computed(() => ({
  left: `${centerX.value - 3}px`,
  background: axisGradient(
    scale.value.yearToY(1),
    scale.value.yearToY(1500),
  ),
}))

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

/** 内容宽度或视口宽度变化后自动重新居中，保证主轴稳定在视口水平中心 */
watch(
  contentW,
  () => {
    nextTick(centerHorizontally)
    // 重试两次，规避布局/滚动尚未就绪的时序问题
    setTimeout(centerHorizontally, 60)
    setTimeout(centerHorizontally, 200)
  },
  { immediate: true },
)

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

/** 点击时间轴空白区域（节点点击已 stopPropagation）时关闭详情面板 */
function onBackgroundClick() {
  if (store.selected) store.select(null)
}

/** 压缩区间的锯齿路径（在宽 8 的窄区域内左右往复），提示时间被压缩省略 */
function compressSaw(h: number): string {
  const teeth = Math.max(2, Math.round(h / 12))
  const step = h / teeth
  let d = ''
  for (let i = 0; i <= teeth; i++) {
    const x = i % 2 === 0 ? 1 : 7
    d += `${i === 0 ? 'M' : 'L'} ${x} ${(i * step).toFixed(1)} `
  }
  return d
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
    @click="onBackgroundClick"
  >
    <!-- 虚拟滚动占位：撑开完整时间轴高度（横向超出时可横向滚动） -->
    <div class="relative" :style="{ height: `${contentH}px`, width: `${contentW}px` }">
      <!-- 主时间轴线：三段年代实色，段间渐变过渡 -->
      <div
        class="absolute top-0 bottom-0 w-6px rounded-full"
        :style="axisStyle"
      />

      <!-- 事件年份刻度文案：年代色 + 纸底，浮于连线之上（z-4），不被遮挡 -->
      <template v-for="mark in marks" :key="mark.year">
        <div
          class="absolute z-4 whitespace-nowrap text-11px leading-12px select-none bg-paper rounded px-4px"
          :style="{
            top: `${mark.y - 7}px`,
            left: `${centerX + 12}px`,
            color: ERA_COLORS[eraOf(mark.year)],
          }"
        >
          {{ mark.year < 0 ? `公元前${-mark.year}` : mark.year === 0 ? `公元元年` : `公元${mark.year}` }}
        </div>
      </template>

      <!-- 空白压缩区间：轴内断裂锯齿 + 左侧小灰字「略 N 年」 -->
      <template v-for="g in gaps" :key="`gap-${g.from}-${g.to}`">
        <svg
          class="absolute z-1 pointer-events-none"
          :style="{ top: `${g.y0}px`, height: `${g.y1 - g.y0}px`, left: `${centerX - 4}px` }"
          width="8"
          :height="g.y1 - g.y0"
        >
          <path
            :d="compressSaw(g.y1 - g.y0)"
            fill="none"
            stroke="#f5efe2"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        <div
          class="absolute z-1 whitespace-nowrap text-9px leading-none text-ink-light/70 select-none bg-paper/90 rounded px-3px"
          :style="{
            top: `${(g.y0 + g.y1) / 2 - 5}px`,
            left: `${centerX - 48}px`,
          }"
        >
          略 {{ g.to - g.from }} 年
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
      />
    </div>
  </div>
</template>
