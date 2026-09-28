import { defineConfig, presetUno, presetAttributify } from 'unocss'

// 全历史风格：宣纸米白 + 青铜赭金 + 墨色
export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  theme: {
    colors: {
      paper: '#f5efe2',
      'paper-deep': '#ece3d0',
      ink: '#3a3128',
      'ink-light': '#6b5d4d',
      bronze: '#9c6b3c',
      'bronze-deep': '#7a4f27',
      gold: '#c2a06a',
      china: '#b3402f',
      world: '#4a6b52',
    },
    fontFamily: {
      serif: '"Noto Serif SC", "Songti SC", "SimSun", Georgia, serif',
    },
  },
  shortcuts: {
    'panel-shadow': 'shadow-[0_12px_40px_rgba(58,49,40,0.25)]',
    'card-base':
      'bg-paper/95 border border-bronze/35 rounded backdrop-blur-sm transition-all duration-200',
  },
})
