<script setup lang="ts">
import { computed } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import { curvePath, formatYear, parallelEvents, yearToY } from '@/utils/timeline'

const store = useTimelineStore()

const PANEL_W = 386

const item = computed(() => store.selected)

/** 节点圆点在视口中的位置 */
const anchor = computed(() => ({
  x: store.centerX,
  y: item.value ? yearToY(item.value.year, store.pxPerYear) - store.scrollTop : 0,
}))

/** 面板侧的曲线终点 */
const panelAnchor = computed(() => {
  if (!item.value) return { x: 0, y: 0 }
  return item.value.type === 'china'
    ? { x: store.panelPos.x, y: store.panelPos.y + 36 }
    : { x: store.panelPos.x + PANEL_W, y: store.panelPos.y + 36 }
})

const path = computed(() =>
  curvePath(anchor.value.x, anchor.value.y, panelAnchor.value.x, panelAnchor.value.y),
)

const parallels = computed(() =>
  item.value ? parallelEvents(store.filteredItems, item.value, 60) : [],
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
    <!-- 曲线连接层（视口固定） -->
    <svg class="fixed inset-0 z-40 w-full h-full pointer-events-none">
      <path
        :d="path"
        fill="none"
        :stroke="item.type === 'china' ? '#b3402f' : '#4a6b52'"
        stroke-width="2"
        stroke-dasharray="6 4"
        opacity="0.75"
      />
      <circle
        :cx="panelAnchor.x"
        :cy="panelAnchor.y"
        r="4"
        :fill="item.type === 'china' ? '#b3402f' : '#4a6b52'"
      />
    </svg>

    <!-- 可拖动详情面板 -->
    <section
      class="panel-in panel-shadow fixed z-50 w-386px max-w-[92vw] max-h-[78vh] flex flex-col bg-paper border border-bronze/50 rounded-lg overflow-hidden"
      :style="{ left: `${store.panelPos.x}px`, top: `${store.panelPos.y}px` }"
    >
      <header
        class="flex items-center gap-8px px-14px h-52px bg-paper-deep border-b border-bronze/30 cursor-grab active:cursor-grabbing select-none"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <span
          class="text-11px px-6px py-2px rounded text-paper"
          :class="item.type === 'china' ? 'bg-china' : 'bg-world'"
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
            :class="item.type === 'china' ? 'border-china/60' : 'border-world/60'"
          >
            <div class="text-13px font-bold text-ink">{{ ev.eventName }}</div>
            <div class="text-11px text-bronze-deep mt-1px">人物：{{ ev.figures }}</div>
            <p class="text-12px text-ink-light mt-2px leading-relaxed">{{ ev.desc }}</p>
          </li>
        </ul>

        <h3 class="text-13px font-bold text-ink mb-6px">
          同期对照 <span class="text-11px font-normal text-ink-light">（前后 60 年中外并行事件）</span>
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
