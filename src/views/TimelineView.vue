<script setup lang="ts">
import ControlBar from '@/components/ControlBar.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'
import DetailPanel from '@/components/DetailPanel.vue'
</script>

<template>
  <div class="paper-texture h-screen w-screen overflow-hidden relative">
    <ControlBar />
    <TimelineCanvas />
    <DetailPanel />
  </div>
</template>
