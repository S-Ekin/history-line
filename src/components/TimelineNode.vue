<script setup lang="ts">
import { computed } from 'vue'
import type { LaidOutNode } from '@/types/history'
import { useTimelineStore } from '@/stores/timeline'

const props = defineProps<{
  node: LaidOutNode
  centerX: number
}>()

const store = useTimelineStore()

const style = computed(() => ({
  top: `${props.node.y}px`,
  left: `${props.centerX + props.node.x}px`,
  width: '218px',
}))

/** 节点到主轴的连接线 */
const stubStyle = computed(() => {
  const isChina = props.node.item.type === 'china'
  return {
    top: `${props.node.y + 31}px`,
    left: isChina ? `${props.centerX + props.node.x + 218}px` : `${props.centerX}px`,
    width: isChina ? `${-(props.node.x) - 218}px` : `${props.node.x}px`,
  }
})

const dotStyle = computed(() => ({
  top: `${props.node.y + 25}px`,
  left: `${props.centerX - 7}px`,
}))

const isActive = computed(() => store.selected?.id === props.node.item.id)

function onClick() {
  store.select(props.node.item)
}
</script>

<template>
  <!-- 横向连接短线 -->
  <div
    class="absolute h-2px pointer-events-none"
    :class="node.item.type === 'china' ? 'bg-china/40' : 'bg-world/40'"
    :style="stubStyle"
  />
  <!-- 主轴上的节点圆点 -->
  <div
    class="absolute z-2 h-14px w-14px rounded-full border-2 border-paper pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-130"
    :class="[node.item.type === 'china' ? 'bg-china' : 'bg-world', isActive ? 'scale-140 ring-2 ring-gold' : '']"
    :style="dotStyle"
    @click="onClick"
  />
  <!-- 分集卡片 -->
  <button
    type="button"
    class="card-base node-in absolute z-3 h-64px px-10px py-6px text-left cursor-pointer hover:-translate-y-2px hover:border-bronze hover:shadow-md"
    :class="[
      node.item.type === 'china' ? 'hover:border-china' : 'hover:border-world',
      isActive ? 'border-gold shadow-md' : '',
    ]"
    :style="style"
    @click="onClick"
  >
    <div class="flex items-center gap-6px">
      <span
        class="shrink-0 text-10px px-4px py-1px rounded text-paper"
        :class="node.item.type === 'china' ? 'bg-china' : 'bg-world'"
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
