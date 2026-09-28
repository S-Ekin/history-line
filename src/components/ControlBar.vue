<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useTimelineStore } from '@/stores/timeline'
import type { DisplayMode, HistoryItem } from '@/types/history'
import { createScale, formatYear } from '@/utils/timeline'

const store = useTimelineStore()

const modes: { value: DisplayMode; label: string }[] = [
  { value: 'both', label: '双线对照' },
  { value: 'china', label: '只看中国' },
  { value: 'world', label: '只看世界' },
]

const showResults = ref(false)
const searchBox = ref<HTMLElement | null>(null)

const placeholder = computed(() => '输入年份快速跳转，如 221 / 前221')

function jump(item: HistoryItem) {
  store.keyword = ''
  showResults.value = false
  store.select(item)
  const el = document.querySelector('.tl-scroll') as HTMLElement | null
  if (el) {
    const scale = createScale(store.filteredItems, store.pxPerYear)
    const y = scale.yearToY(item.year) - window.innerHeight / 2
    el.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }
}

function jumpRawYear() {
  const kw = store.keyword.trim()
  const n = Number(kw.replace(/^前/, ''))
  if (!Number.isFinite(n) || n === 0) return
  const year = kw.startsWith('前') ? -n : n
  const el = document.querySelector('.tl-scroll') as HTMLElement | null
  const scale = createScale(store.filteredItems, store.pxPerYear)
  el?.scrollTo({
    top: Math.max(0, scale.yearToY(year) - window.innerHeight / 2),
    behavior: 'smooth',
  })
  store.keyword = ''
}

function onDocClick(e: MouseEvent) {
  if (searchBox.value && !searchBox.value.contains(e.target as Node)) showResults.value = false
}

function resetZoom() {
  store.pxPerYear = 1.5
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div
    class="fixed top-0 inset-x-0 z-50 h-56px bg-paper/95 backdrop-blur border-b border-bronze/35 flex items-center gap-12px px-16px"
  >
    <!-- 品牌 -->
    <div class="flex items-center gap-8px shrink-0">
      <img src="/scroll.svg" alt="logo" class="w-28px h-28px" />
      <div class="leading-tight">
        <div class="text-16px font-bold text-ink tracking-2px">经纬历史</div>
        <div class="text-10px text-ink-light">中国 × 世界 · 双线对照时间轴</div>
      </div>
    </div>

    <!-- 年份搜索 -->
    <div ref="searchBox" class="relative w-250px shrink-0">
      <input
        v-model="store.keyword"
        type="text"
        class="w-full h-32px px-10px text-12px bg-paper-deep/70 border border-bronze/40 rounded outline-none focus:border-bronze text-ink placeholder:text-ink-light/60"
        :placeholder="placeholder"
        @focus="showResults = true"
        @keydown.enter="jumpRawYear"
      />
      <div
        v-if="showResults && store.searchResults.length"
        class="absolute top-36px inset-x-0 bg-paper border border-bronze/40 rounded panel-shadow py-4px max-h-320px overflow-y-auto tl-scroll"
      >
        <button
          v-for="r in store.searchResults"
          :key="r.id"
          type="button"
          class="w-full text-left px-10px py-6px hover:bg-paper-deep flex items-center gap-8px"
          @click="jump(r)"
        >
          <span
            class="text-10px px-4px py-1px rounded text-paper shrink-0"
            :class="r.type === 'china' ? 'bg-china' : 'bg-world'"
          >
            {{ r.type === 'china' ? '中' : '世' }}
          </span>
          <span class="flex-1 text-12px text-ink truncate">{{ r.title }}</span>
          <span class="text-10px text-ink-light shrink-0">{{ formatYear(r.year) }}</span>
        </button>
      </div>
    </div>

    <!-- 显示模式 -->
    <div class="flex border border-bronze/40 rounded overflow-hidden shrink-0">
      <button
        v-for="m in modes"
        :key="m.value"
        type="button"
        class="px-10px h-32px text-12px border-r border-bronze/30 last:border-r-0 transition-colors"
        :class="store.displayMode === m.value ? 'bg-bronze text-paper' : 'text-ink hover:bg-paper-deep'"
        @click="store.setDisplayMode(m.value)"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- 缩放 -->
    <div class="flex items-center gap-4px shrink-0">
      <button
        type="button"
        class="w-30px h-32px text-14px border border-bronze/40 rounded hover:bg-paper-deep text-ink"
        title="缩小"
        @click="store.zoom(1 / 1.3)"
      >
        −
      </button>
      <button
        type="button"
        class="w-30px h-32px text-14px border border-bronze/40 rounded hover:bg-paper-deep text-ink"
        title="放大"
        @click="store.zoom(1.3)"
      >
        ＋
      </button>
      <button
        type="button"
        class="px-8px h-32px text-11px border border-bronze/40 rounded hover:bg-paper-deep text-ink-light"
        @click="resetZoom"
      >
        重置
      </button>
    </div>

    <div class="flex-1 hidden lg:block text-right text-10px text-ink-light/80 shrink-0">
      滚轮纵向浏览 · Ctrl + 滚轮缩放时间刻度 · 点击节点查看详情与同期对照
    </div>
  </div>
</template>
