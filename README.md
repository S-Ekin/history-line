# 经纬历史 · 中国与世界双线对照时间轴

世界历史 100 集 + 中国历史 100 集，以公元年份为最小刻度的纵向双线时间轴网站。
设计风格参考「全历史 allhistory」：宣纸底色、青铜赭金、墨色文字，简约复古。

## 技术栈

Vue 3 `<script setup>` + TypeScript + Vite 6 + Pinia + UnoCSS + ESLint 9（flat config）+ Prettier。

## 快速开始

```bash
npm install
npm run dev      # 本地开发
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
npm run lint     # ESLint 自动修复
```

## 目录结构

```
history-timeline/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json / tsconfig.node.json
├─ uno.config.ts                # UnoCSS 主题（宣纸/青铜/墨色）
├─ eslint.config.js             # ESLint flat config
├─ public/scroll.svg
└─ src/
   ├─ main.ts / App.vue
   ├─ env.d.ts
   ├─ styles/global.css         # 宣纸纹理、滚动条、动画
   ├─ types/history.ts          # HistoryItem / KeyEvent / LaidOutNode / Tick
   ├─ data/
   │  ├─ china.ts               # 《中国通史》100 集：年份 + 事件 + 人物
   │  ├─ world.ts               # 《世界历史》100 集：年份 + 事件 + 人物
   │  └─ index.ts               # 合并 200 集
   ├─ stores/timeline.ts        # Pinia：显示模式/缩放/选中/面板/搜索/视口
   ├─ utils/timeline.ts         # 年份坐标换算、自适应刻度、布局、虚拟过滤、曲线路径
   ├─ views/TimelineView.vue
   └─ components/
      ├─ ControlBar.vue         # 年份搜索跳转、双线开关、缩放
      ├─ TimelineCanvas.vue     # 核心：虚拟滚动容器、主轴、刻度、纪元标记
      ├─ TimelineNode.vue       # 节点卡片 + 轴上圆点 + 连接短线
      └─ DetailPanel.vue        # 可拖动详情面板 + 贝塞尔曲线 + 同期对照
```

## 核心设计

### 数据模型（`src/types/history.ts`）

```ts
interface HistoryItem {
  id: string                 // c-{ep} / w-{ep}
  title: string              // 分集标题
  year: number               // 负数=公元前，正数=公元后，最小刻度 1 年
  type: 'china' | 'world'
  episode: number            // 1-100
  keyEvents: { eventName: string; figures: string; desc: string }[]
}
```

### 年份坐标

- `yearToY(year, pxPerYear)`：连续纪年换算，正确处理「无公元 0 年」（公元前 1 年下一年即公元 1 年）。
- 时间范围：公元前 300000 年（旧石器时代）— 公元 2000 年。
- 缩放范围：0.02–30 px/年，Ctrl + 滚轮以鼠标位置为锚点缩放。

### 性能：虚拟滚动

- 内容容器按 `总年份跨度 × px/年` 撑开高度（无任何年份 DOM）。
- 仅渲染视口 + 缓冲区（约 500px）内的节点与刻度，200+ 节点下 DOM 恒定在几十个。
- scroll 事件经 `requestAnimationFrame` 节流。

### 同年并列

按年份分组：中国线同年节点依次向更左侧泳道排布，世界线向右侧镜像排布，
节点永不重叠遮挡。

### 详情面板与同期对照

- 点击节点弹出面板，**可拖动**（Pointer Events + setPointerCapture）。
- 面板与轴上圆点之间用三次贝塞尔虚线连接（SVG 视口固定层，随滚动实时重算）。
- 面板列出该集关键事件/人物，并自动汇总前后 60 年内中外并行事件，点击可切换。

### 其他

- 顶部搜索框：年份（`221` / `前221`）或标题/事件模糊搜索，回车/点击平滑跳转。
- 显示模式：双线对照 / 只看中国 / 只看世界。
- 刻度自适应：按 px/年从 `[1,2,5,10,…,100000]` 中选取合适间隔。
- BC/AD 双标注：轴右侧 `BC 前xxx / AD xxx`，左侧 `公元前xxx年 / 公元xxx年`，
  并在公元 1 年处设置「AD 公元纪元」分界标记。
- PC 端优先，移动端面板与控制栏自适应收窄。
