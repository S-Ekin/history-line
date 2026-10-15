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

const PANEL_W = 470
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

/** 五段式描述标签顺序 */
const DESC_LABELS = ['【背景】', '【起因】', '【发展】', '【结果】', '【影响】']

/**
 * 把「【背景】…【起因】…」格式的描述拆分为五段，便于分段展示；
 * 兼容不含标签的旧描述（整体作为一段）。
 */
function descSegments(desc: string): { label: string; text: string }[] {
  const re = /(【背景】|【起因】|【发展】|【结果】|【影响】)/g
  const parts = desc.split(re).filter(Boolean)
  const segs: { label: string; text: string }[] = []
  for (let i = 0; i < parts.length; i++) {
    if (DESC_LABELS.includes(parts[i]) && parts[i + 1] !== undefined) {
      segs.push({ label: parts[i].slice(1, -1), text: parts[i + 1] })
      i++
    }
  }
  return segs.length ? segs : [{ label: '', text: desc }]
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
    <!-- 曲线连接层（位于面板之上，保证不被模态框遮挡） -->
    <svg class="fixed inset-0 z-[65] w-full h-full pointer-events-none">
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

    <!-- 面板侧端点：层级高于曲线与面板，保证完整显示 -->
    <svg class="fixed inset-0 z-[70] w-full h-full pointer-events-none">
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
      class="panel-in panel-shadow fixed z-50 w-470px max-w-[94vw] max-h-[86vh] flex flex-col bg-paper border-2 rounded-xl overflow-hidden"
      :style="{
        left: `${store.panelPos.x}px`,
        top: `${store.panelPos.y}px`,
        borderColor: eraColor,
      }"
    >
      <header
        class="flex items-center gap-8px px-13px h-46px bg-paper-deep border-b border-bronze/30 cursor-grab active:cursor-grabbing select-none"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <span
          class="text-10px px-6px py-2px rounded text-paper shrink-0"
          :style="{ background: eraColor }"
        >
          {{ item.type === 'china' ? `中国 · 第${item.episode}集` : `世界 · 第${item.episode}集` }}
        </span>
        <h2 class="flex-1 text-15px font-bold text-ink truncate">{{ item.title }}</h2>
        <button
          type="button"
          class="text-ink-light hover:text-china text-18px leading-none px-4px shrink-0"
          title="关闭"
          @click="close"
        >
          ×
        </button>
      </header>

      <div class="overflow-y-auto tl-scroll px-13px py-10px">
        <!-- 年份分隔条 -->
        <div class="flex items-center gap-8px mb-8px">
          <span class="text-11px font-bold text-bronze-deep whitespace-nowrap">{{ formatYear(item.year) }}</span>
          <span class="flex-1 h-1px bg-bronze/25" />
        </div>

        <h3 class="section-title text-12px font-bold text-ink mb-5px">关键事件 · 核心人物</h3>
        <ul class="space-y-7px mb-11px">
          <li
            v-for="(ev, idx) in item.keyEvents"
            :key="idx"
            class="border-l-[3px] pl-9px py-1px"
            :style="{ borderColor: eraColor }"
          >
            <div class="text-13px font-bold text-ink leading-tight">{{ ev.eventName }}</div>
            <div class="text-11px text-bronze-deep mt-1px">
              <span class="font-bold">核心人物</span> {{ ev.figures }}
            </div>
            <div class="text-12px text-ink-light mt-3px leading-[1.5] space-y-1px text-justify">
              <p v-for="(s, i) in descSegments(ev.desc)" :key="i">
                <span
                  v-if="s.label"
                  class="inline-block min-w-28px text-center text-[10px] font-bold leading-14px px-3px mr-5px rounded-sm align-1px"
                  :style="{ background: `${eraColor}1f`, color: eraColor }"
                >{{ s.label }}</span><template v-if="!s.label">　</template>{{ s.text }}
              </p>
            </div>
          </li>
        </ul>

        <h3 class="section-title text-12px font-bold text-ink mb-5px">
          同期对照 <span class="text-10px font-normal text-ink-light">（前后 {{ currentSpan }} 年中外并行事件）</span>
        </h3>
        <div class="grid grid-cols-2 gap-6px">
          <div>
            <div class="text-11px text-china font-bold mb-4px">中国历史</div>
            <p v-if="!chinaParallels.length" class="text-11px text-ink-light/70">暂无同期分集</p>
            <button
              v-for="p in chinaParallels"
              v-else
              :key="p.id"
              type="button"
              class="block w-full text-left text-11px px-6px py-3px mb-3px rounded border border-china/30 hover:bg-china/10 text-ink truncate"
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
              class="block w-full text-left text-11px px-6px py-3px mb-3px rounded border border-world/30 hover:bg-world/10 text-ink truncate"
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

<style scoped>
/* 小标题前的竖线装饰 */
.section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 11px;
  margin-right: 5px;
  background: currentColor;
  border-radius: 1px;
  vertical-align: -1px;
}
</style>
