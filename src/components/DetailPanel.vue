<script setup lang="ts">
import { computed } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { allHistory } from '@/data'
import {
  createScale,
  curvePath,
  formatYear,
  parallelEvents,
  parallelSpanByDensity,
  ERA_COLORS,
  eraOf,
} from '@/utils/timeline'

const store = useTimelineStore()

const PANEL_W = 386
/** 滚动容器距离视口顶部的偏移（对应 TimelineCanvas 的 top-56px） */
const SCROLL_OFFSET_TOP = 56

const item = computed(() => store.selected)

/** 选中事件所属年代的系列色 */
const eraColor = computed(() =>
  item.value ? ERA_COLORS[eraOf(item.value.year)] : '#3a3128',
)

/** 与画布一致的比例尺（始终基于全量数据） */
const scale = computed(() => createScale(allHistory, store.pxPerYear))

/**
 * 事件节点侧端点：主轴上的节点圆点（视口坐标）
 * y 转换公式：内容坐标 - scrollTop + 滚动容器 top 偏移 + dot 中心偏移
 */
const nodeAnchor = computed(() => ({
  // 内容坐标减去横向滚动量，得到主轴的视口 x
  x: store.centerX - store.scrollLeftX,
  // 内容 y - 纵向滚动 + 滚动容器 top 偏移（圆点中心即刻度 node.y）
  y: item.value
    ? scale.value.yearToY(item.value.year) - store.scrollTop + SCROLL_OFFSET_TOP
    : 0,
}))

/**
 * 面板侧端点：面板左右竖边中离节点较近的一条，标题栏高度
 */
const panelAnchor = computed(() => {
  const y = store.panelPos.y + 36
  const left = { x: store.panelPos.x, y }
  const right = { x: store.panelPos.x + PANEL_W, y }
  return Math.abs(left.x - nodeAnchor.value.x) <= Math.abs(right.x - nodeAnchor.value.x)
    ? left
    : right
})

const path = computed(() =>
  curvePath(nodeAnchor.value.x, nodeAnchor.value.y, panelAnchor.value.x, panelAnchor.value.y),
)

/** 当前选中事件的同期对照跨度（按事件密度动态计算，上限 1500 年） */
const currentSpan = computed(() =>
  item.value ? parallelSpanByDensity(store.filteredItems, item.value) : 5,
)

const parallels = computed(() =>
  item.value ? parallelEvents(store.filteredItems, item.value, currentSpan.value) : [],
)
const chinaParallels = computed(() => parallels.value.filter((i) => i.type === 'china'))
const worldParallels = computed(() => parallels.value.filter((i) => i.type === 'world'))

function close() {
  store.select(null)
}

function pick(id: string) {
  const next = store.filteredItems.find((i) => i.id === id)
  if (next) store.select(next)
}

/* 面板拖动 */
let dragging = false
let offsetX = 0
let offsetY = 0

function onPointerDown(e: PointerEvent) {
  // 点击按钮时不启动拖动，保证 click 正常触发
  if ((e.target as HTMLElement).closest('button')) return
  dragging = true
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  offsetX = e.clientX - store.panelPos.x
  offsetY = e.clientY - store.panelPos.y
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return
  const x = Math.min(window.innerWidth - 80, Math.max(-PANEL_W + 100, e.clientX - offsetX))
  const y = Math.min(window.innerHeight - 60, Math.max(0, e.clientY - offsetY))
  store.movePanel(x, y)
}

function onPointerUp(e: PointerEvent) {
  dragging = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
}
</script>

<template>
  <template v-if="item">
    <!-- 曲线连接层（位于面板之下） -->
    <svg class="fixed inset-0 z-40 w-full h-full pointer-events-none">
      <path
        :d="path"
        fill="none"
        :stroke="eraColor"
        stroke-width="2.5"
        stroke-dasharray="6 4"
      />
      <!-- 节点侧端点 -->
      <circle
        :cx="nodeAnchor.x"
        :cy="nodeAnchor.y"
        r="5"
        :fill="eraColor"
        stroke="#f5efe2"
        stroke-width="2"
      />
    </svg>

    <!-- 面板侧端点：层级高于面板，保证完整显示 -->
    <svg class="fixed inset-0 z-[60] w-full h-full pointer-events-none">
      <circle
        :cx="panelAnchor.x"
        :cy="panelAnchor.y"
        r="5.5"
        :fill="eraColor"
        stroke="#f5efe2"
        stroke-width="2"
      />
    </svg>

    <!-- 可拖动详情面板 -->
    <section
      class="panel-in panel-shadow fixed z-50 w-386px max-w-[92vw] max-h-[78vh] flex flex-col bg-paper border rounded-lg overflow-hidden"
      :style="{
        left: `${store.panelPos.x}px`,
        top: `${store.panelPos.y}px`,
        borderColor: eraColor,
      }"
    >
      <header
        class="flex items-center gap-8px px-14px h-52px bg-paper-deep border-b border-bronze/30 cursor-grab active:cursor-grabbing select-none"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <span
          class="text-11px px-6px py-2px rounded text-paper"
          :style="{ background: eraColor }"
        >
          {{ item.type === 'china' ? `中国 · 第${item.episode}集` : `世界 · 第${item.episode}集` }}
        </span>
        <h2 class="flex-1 text-16px font-bold text-ink truncate">{{ item.title }}</h2>
        <button
          type="button"
          class="text-ink-light hover:text-china text-18px leading-none px-4px"
          title="关闭"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="overflow-y-auto tl-scroll px-14px py-12px">
        <div class="text-12px text-bronze-deep mb-10px">
          {{ formatYear(item.year) }}
        </div>

        <h3 class="text-13px font-bold text-ink mb-6px">关键事件 · 核心人物</h3>
        <ul class="space-y-8px mb-14px">
          <li
            v-for="(ev, idx) in item.keyEvents"
            :key="idx"
            class="border-l-[3px] pl-10px py-2px"
            :style="{ borderColor: eraColor }"
          >
            <div class="text-13px font-bold text-ink">{{ ev.eventName }}</div>
            <div class="text-11px text-bronze-deep mt-1px">人物：{{ ev.figures }}</div>
            <p class="text-12px text-ink-light mt-2px leading-relaxed">{{ ev.desc }}</p>
          </li>
        </ul>

        <h3 class="text-13px font-bold text-ink mb-6px">
          同期对照 <span class="text-11px font-normal text-ink-light">（前后 {{ currentSpan }} 年中外并行事件）</span>
        </h3>
        <div class="grid grid-cols-2 gap-8px">
          <div>
            <div class="text-11px text-china font-bold mb-4px">中国历史</div>
            <p v-if="!chinaParallels.length" class="text-11px text-ink-light/70">暂无同期分集</p>
            <button
              v-for="p in chinaParallels"
              v-else
              :key="p.id"
              type="button"
              class="block w-full text-left text-11px px-6px py-4px mb-4px rounded border border-china/30 hover:bg-china/10 text-ink truncate"
              @click="pick(p.id)"
            >
              {{ p.year < 0 ? `前${-p.year}` : p.year }} · {{ p.title }}
            </button>
          </div>
          <div>
            <div class="text-11px text-world font-bold mb-4px">世界历史</div>
            <p v-if="!worldParallels.length" class="text-11px text-ink-light/70">暂无同期分集</p>
            <button
              v-for="p in worldParallels"
              v-else
              :key="p.id"
              type="button"
              class="block w-full text-left text-11px px-6px py-4px mb-4px rounded border border-world/30 hover:bg-world/10 text-ink truncate"
              @click="pick(p.id)"
            >
              {{ p.year < 0 ? `前${-p.year}` : p.year }} · {{ p.title }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </template>
</template>
