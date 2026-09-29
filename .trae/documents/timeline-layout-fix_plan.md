# 时间轴布局与交互优化实施计划

## 需求概述（3 项关联改动）

1. **节点卡片不遮挡主轴刻度文案**：当前中国线卡片紧贴主轴，其右边缘遮挡了左侧"公元前xxxx年/公元xxxx年"刻度文字的尾部。
2. **节点颜色随时间渐变变淡**：越早的节点透明度越低，但设置最小阈值（0.55）保证可辨识；文字保持不透明。
3. **曲线端点精确连接放大节点**：详情面板打开时，连接曲线的节点端点必须精确命中主轴上放大选中的节点圆点。

---

## 需求 1：节点布局避让刻度文案

### 问题定位
- 当前 `AXIS_GAP = 26px`（`src/utils/timeline.ts`），lane-0 卡片右边缘距主轴仅 26px
- 左侧刻度文字 `width: centerX - 26 - 12, left: 8px`，右边缘距主轴 38px
- 卡片 stub（26px）与刻度文字（26-38px 区间）重叠，视觉上卡片遮挡文字尾部

### 实施步骤

**1a. 增加卡片与主轴间距**（`src/utils/timeline.ts`）
```
AXIS_GAP: 26 → 50
```
lane-0 卡片右边缘从主轴向外扩展到 50px，stub 长度同步增长。

**1b. 调整刻度文字位置**（`src/components/TimelineCanvas.vue`）

左侧刻度文字（"公元前xxxx年"）：
- 把 top 偏移从 `mark.y - 6` 改为 `mark.y + 16`（刻度圆点下方一行，避开卡片主体区域）
- 宽度限制调整为 `centerX - 56`（配合新的 AXIS_GAP=50，避免与 stub 重叠）
- 保留 text-align: right

右侧刻度文字（"BC/AD xxx"）：
- 保持不变，当前 `centerX + 14` 位置无遮挡

**1c. 同步更新中心宽度计算**（`TimelineCanvas.vue`）
- `halfSpan` 中的 `AXIS_GAP` 引用会随常量修改自动适配
- `contentW = halfSpan * 2` 会相应扩大

---

## 需求 2：节点颜色随时间渐变

### 设计方案
- 在 CSS 中通过 inline style 设置 `opacity`，控制卡片和圆点的背景/边框透明度
- 文字内容（标题、年份、关键事件）保持 `opacity: 1` 不透明，确保可读性
- 渐变公式：基于全量数据的年份范围做线性归一化

### 实施步骤

**2a. 在 utils 中新增渐变计算函数**（`src/utils/timeline.ts`）
```ts
// 计算节点的时间进度：最早年→0，最晚年→1
export function yearProgress(year: number, minYear: number, maxYear: number): number {
  if (maxYear === minYear) return 1
  return (year - minYear) / (maxYear - minYear)
}

// 根据进度计算节点透明度：最早→minOpacity，最晚→1.0
export function nodeOpacity(progress: number, minOpacity = 0.55): number {
  return minOpacity + (1 - minOpacity) * Math.min(1, Math.max(0, progress))
}
```

**2b. 在 TimelineNode.vue 中应用渐变**（`src/components/TimelineNode.vue`）
- 新增 props：接收 minYear / maxYear（由父组件 TimelineCanvas 传入）
- 计算每个节点的 opacity，通过 inline style 设置卡片和 dot 的 opacity
- 卡片内文字元素覆盖 `opacity: 1`
- stub（横向短线）同步应用 opacity

**2c. TimelineCanvas 传入年份范围**
```ts
// 从 store.filteredItems 计算 minYear/maxYear
const yearRange = computed(() => {
  const years = store.filteredItems.map((i) => i.year)
  return { min: Math.min(...years), max: Math.max(...years) }
})
```

---

## 需求 3：曲线端点精确连接放大节点

### 问题定位
- DetailPanel 中独立计算了一个 `scale = createScale(store.filteredItems, store.pxPerYear)`
- TimelineCanvas 也有自己的 scale computed（同样参数，但独立实例）
- 两者可能因任何 timing/依赖差异导致 `yearToY` 结果不完全一致
- 曲线端点 y 使用 `yearToY(item.year) - scrollTop + 32`（+32 是 dot 中心偏移）
- 放大的 dot（scale-140）视觉中心仍在同一位置（CSS transform 不改变元素坐标）

### 实施步骤

**3a. 在 Pinia store 中同步节点布局数据**（`src/stores/timeline.ts`）
新增一个 `computed` 属性，暴露当前 filtered items 的完整年份范围：
```ts
const yearRange = computed(() => {
  const items = store.filteredItems
  if (!items.length) return { min: -700000, max: 2025 }
  const years = items.map((i) => i.year)
  return { min: Math.min(...years), max: Math.max(...years) }
})
```

这样 TimelineCanvas 和 DetailPanel 共用同一个年份范围。

**3b. DetailPanel 的 scale 计算保持同步**
DetailPanel 中 `scale` 和 TimelineCanvas 的 `scale` 参数完全一致（`store.filteredItems`, `store.pxPerYear`），两者应产生相同的 yearToY 映射。

**3c. 精确调整 nodeAnchor 的 y 偏移**
当前 DetailPanel 中 `+ 32` 的计算假设 dot 高度为 14px（h-14px）。放大的 dot（scale-140）元素坐标的中心仍在 y+32，不需要偏移。确认此值正确即可。

**3d. 选中态 dot 视觉强化**
TimelineNode 中选中的 dot：
```html
:class="[..., isActive ? 'scale-140 ring-2 ring-gold' : '']"
```
DetailPanel 中曲线节点端点（SVG circle, r=5）会精确覆盖在放大 dot 的几何中心上（因为 scale 不改变中心位置），视觉上形成重合。

---

## 依赖顺序
需求 1（布局间距）→ 需求 2（颜色渐变）→ 需求 3（曲线精度）

- 修改 AXIS_GAP 会影响所有节点坐标，必须最先完成
- 颜色渐变独立于坐标系统，但 TimelineNode 会被需求 1 改动影响
- 曲线精度依赖需求 1 的 AXIS_GAP 最终值（虽然曲线连接主轴位置不受 AXIS_GAP 影响，但整体视觉对齐需要先确定间距）

## 验证
1. **视觉检查**：启动 dev server，观察公元前 3500 年区域的中国卡片，确认右侧刻度文字完整可见
2. **渐变检查**：对比顶部（公元前 70 万年）和中部（公元 500 年）节点，确认顶部节点明显变淡但仍清晰可读
3. **曲线检查**：点击"中4 文明起源"等左侧中国卡片，确认曲线端点精确命中主轴上的放大红色圆点；点击右侧世界卡片同理
4. **构建通过**：`npm run build` 无 TS / vite 错误

## 风险
- **AXIS_GAP 增大导致单屏可容纳节点减少**：已在 halfSpan 计算中动态扩展 contentW，横向滚动条会自动出现
- **刻度文字下移后与下方节点的 stub 可能碰撞**：下移 22px（mark.y + 16 - mark.y + 6 = 22px 间距），足够避开 CARD_H=64 的卡片高度
- **颜色渐变在切换显示模式时重新计算**：store.filteredItems 变化会触发 TimelineCanvas 和 DetailPanel 的 scale 重新计算，透明度随之更新，符合预期
