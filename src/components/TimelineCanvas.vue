<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import TimelineNode from './TimelineNode.vue'
import {
  AXIS_GAP,
  buildTicks,
  layoutNodes,
  totalHeight,
  visibleNodes,
  yearToY,
} from '@/utils/timeline'

const store = useTimelineStore()

const scrollEl = ref<HTMLElement | null>(null)
const viewportH = ref(window.innerHeight)
const viewportW = ref(window.innerWidth)
const top = ref(0)
let raf = 0

/** 全部节点布局（随缩放/过滤重算） */
const allNodes = computed(() => layoutNodes(store.filteredItems, store.pxPerYear))

/** 虚拟滚动：仅渲染可视区节点 */
const nodes = computed(() =>
  visibleNodes(allNodes.value, top.value, top.value + viewportH.value + 80),
)

/** 可视区刻度 */
const ticks = computed(() =>
  buildTicks(top.value - 60, top.value + viewportH.value + 60, store.pxPerYear),
)

const contentH = computed(() => totalHeight(store.pxPerYear))
const centerX = computed(() => viewportW.value / 2)

function syncViewport() {
  raf = 0
  if (!scrollEl.value) return
  top.value = scrollEl.value.scrollTop
  store.setViewport(top.value, centerX.value)
}

function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(syncViewport)
}

function onResize() {
  viewportH.value = window.innerHeight
  viewportW.value = window.innerWidth
  syncViewport()
}

/** Ctrl + 滚轮：以鼠标位置为锚点缩放 */
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  const el = scrollEl.value!
  const oldPx = store.pxPerYear
  const yearAtCursor = top.value + e.offsetY
  store.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)
  if (oldPx !== store.pxPerYear) {
    nextTick(() => {
      const ratio = store.pxPerYear / oldPx
      el.scrollTop = yearAtCursor * ratio - e.offsetY
      syncViewport()
    })
  }
}

/** 跳转到指定年份 */
function jumpToYear(year: number) {
  if (!scrollEl.value) return
  const y = yearToY(year, store.pxPerYear) - viewportH.value / 2
  scrollEl.value.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
}

defineExpose({ jumpToYear })

onMounted(() => {
  window.addEventListener('resize', onResize)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  // 初始定位到文明早期（公元前 3500 年附近）
  // 延迟到浏览器 load 阶段的滚动恢复之后执行，避免被重置
  setTimeout(() => {
    if (scrollEl.value) {
      scrollEl.value.scrollTop = yearToY(-3500, store.pxPerYear) - viewportH.value / 3
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
    class="tl-scroll absolute inset-0 top-56px overflow-y-auto overflow-x-hidden"
    @scroll="onScroll"
    @wheel="onWheel"
  >
    <!-- 虚拟滚动占位：撑开完整时间轴高度 -->
    <div class="relative w-full" :style="{ height: `${contentH}px` }">
      <!-- 主时间轴线 -->
      <div
        class="absolute top-0 bottom-0 w-2px bg-gradient-to-b from-transparent via-bronze to-transparent"
        :style="{ left: `${centerX}px` }"
      />

      <!-- 年份刻度 -->
      <template v-for="tick in ticks" :key="tick.year">
        <div
          class="absolute h-10px w-2px bg-bronze/50"
          :style="{ top: `${tick.y}px`, left: `${centerX - 1}px` }"
        />
        <div
          class="absolute whitespace-nowrap text-12px leading-10px text-ink-light select-none"
          :style="{ top: `${tick.y - 8}px`, left: `${centerX + 10}px` }"
        >
          {{ tick.year < 0 ? `BC 前${-tick.year}` : `AD ${tick.year}` }}
        </div>
        <div
          class="absolute whitespace-nowrap text-12px leading-10px text-ink-light select-none text-right"
          :style="{ top: `${tick.y - 8}px`, width: `${centerX - AXIS_GAP - 10}px`, left: '8px' }"
        >
          {{ tick.year < 0 ? `公元前${-tick.year}年` : `公元${tick.year}年` }}
        </div>
      </template>

      <!-- 公元元年纪元分界标记 -->
      <div
        class="absolute z-1 flex items-center"
        :style="{ top: `${yearToY(1, store.pxPerYear) - 11}px`, left: `${centerX - 60}px` }"
      >
        <span
          class="w-120px text-center text-11px tracking-3px text-bronze-deep border-y border-bronze/50 py-2px bg-paper/80"
        >
          AD 公元纪元
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
