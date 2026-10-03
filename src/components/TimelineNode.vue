<script setup lang="ts">
import { computed } from 'vue'
import type { LaidOutNode } from '@/types/history'
import { useTimelineStore } from '@/stores/timeline'
import { CARD_H, ERA_COLORS, eraOf } from '@/utils/timeline'

const props = defineProps<{
  node: LaidOutNode
  centerX: number
}>()

const store = useTimelineStore()

const isActive = computed(() => store.selected?.id === props.node.item.id)

/** 该节点所属年代的系列色（圆点 / 连线 / 边框 / 徽章统一） */
const eraColor = computed(() => ERA_COLORS[eraOf(props.node.item.year)])

/** 卡片：以刻度 node.y 为垂直中心，保证卡片准确对应轴上刻度 */
const style = computed(() => ({
  top: `${props.node.y - CARD_H / 2}px`,
  left: `${props.centerX + props.node.x}px`,
  width: '218px',
  borderColor: eraColor.value,
}))

/** 节点到主轴的连接线（水平，垂直对齐刻度，年代色） */
const stubStyle = computed(() => {
  const isChina = props.node.item.type === 'china'
  return {
    top: `${props.node.y - 1}px`,
    background: eraColor.value,
    left: isChina ? `${props.centerX + props.node.x + 218}px` : `${props.centerX}px`,
    width: isChina ? `${-(props.node.x) - 218}px` : `${props.node.x}px`,
  }
})

/** 轴上节点圆点（中心对齐刻度 node.y，年代色） */
const dotStyle = computed(() => ({
  top: `${props.node.y - 7}px`,
  left: `${props.centerX - 7}px`,
  background: eraColor.value,
}))

function onClick() {
  store.select(props.node.item)
}
</script>

<template>
  <!-- 横向连接短线（年代色） -->
  <div class="absolute h-2px pointer-events-none" :style="stubStyle" />
  <!-- 主轴上的节点圆点（年代色） -->
  <div
    class="absolute z-2 h-14px w-14px rounded-full border-2 border-paper pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-130"
    :class="[isActive ? 'node-dot-active' : '']"
    :style="dotStyle"
    @click.stop="onClick"
  />
  <!-- 分集卡片（边框随年代色） -->
  <button
    type="button"
    class="card-base node-in absolute z-3 h-64px px-10px py-6px text-left cursor-pointer hover:-translate-y-2px hover:shadow-md"
    :class="[isActive ? 'node-card-active' : '']"
    :style="style"
    @click.stop="onClick"
  >
    <div class="flex items-center gap-6px">
      <span
        class="shrink-0 text-10px px-4px py-1px rounded text-paper"
        :style="{ background: eraColor }"
      >
        {{ node.item.type === 'china' ? '中' : '世' }}{{ node.item.episode }}
      </span>
      <span class="text-13px font-bold text-ink truncate">{{ node.item.title }}</span>
    </div>
    <div class="mt-3px text-11px text-ink-light truncate">
      {{ node.item.year < 0 ? `公元前${-node.item.year}年` : `公元${node.item.year}年` }}
      · {{ node.item.keyEvents[0]?.eventName }}
    </div>
  </button>
</template>
