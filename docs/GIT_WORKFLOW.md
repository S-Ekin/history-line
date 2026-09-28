# Git 版本管理规范

本仓库遵循大厂常见的 Git Flow 简化版 + Conventional Commits 提交规范。

## 分支模型

| 分支 | 作用 | 命名 |
|---|---|---|
| `main` | 受保护主干，始终保持可发布状态，只接受 PR 合入 | 固定 |
| `dev` | 日常集成分支（多人协作时使用） | 固定 |
| 功能分支 | 新功能开发，从 `dev`/`main` 切出 | `feat/xxx`，如 `feat/year-search` |
| 修复分支 | Bug 修复 | `fix/xxx`，如 `fix/node-overlap` |
| 其他 | 重构/文档/构建 | `refactor/xxx`、`docs/xxx`、`chore/xxx` |

## 提交信息规范（Conventional Commits）

格式：`type(scope): subject`

- `type`：`feat` 新功能 / `fix` 修复 / `refactor` 重构 / `perf` 性能 / `docs` 文档 / `style` 格式 / `test` 测试 / `chore` 构建与工具 / `ci` CI
- `scope`（可选）：模块名，如 `timeline`、`data`、`eslint`
- `subject`：简明中文描述，不加句号

示例：

```
feat(timeline): 实现虚拟滚动与自适应年份刻度
fix(data): 修正世界历史第98集苏伊士运河年份
docs: 补充 Git 工作流规范
```

破坏性变更：在 type 后加 `!`，并在正文写明 `BREAKING CHANGE: ...`。

## 常用工作流

```bash
# 1. 切功能分支
git switch -c feat/parallel-compare

# 2. 小步提交（提交前先 lint + build）
npm run lint && npm run build
git add <具体文件>          # 避免 git add . 带入无关文件
git commit -m "feat(panel): 增加同期对照事件列表"

# 3. 同步主干（推荐 rebase 保持线性历史）
git fetch origin
git rebase origin/main      # 冲突逐个解决后 git rebase --continue

# 4. 推送并发起 PR（需用户明确指示后才执行 push）
git push -u origin feat/parallel-compare
```

## 冲突避免与处理

- 功能分支短命、小步合入，每天同步一次主干。
- 不同人负责不同目录（如 `data/` 与 `components/`），减少同文件并发修改。
- rebase 冲突：`git status` 查看冲突文件 → 手动解决 → `git add` → `git rebase --continue`；
  放弃 rebase：`git rebase --abort`。

## 常用回退操作

| 场景 | 命令 |
|---|---|
| 撤销工作区某文件修改 | `git restore <file>` |
| 撤销已暂存 | `git restore --staged <file>` |
| 撤销最近一次提交（保留改动） | `git reset --soft HEAD~1` |
| 临时保存现场 | `git stash` / `git stash pop` |
| 查看某提交 | `git show <commit>` |

## 合入规则

- `main` 分支禁止直接 push，功能分支通过 PR + 至少一人 CR 后合入。
- 合入前必须通过 `npm run lint` 与 `npm run build`。
- 推荐 Squash merge：一个功能分支在主干上只保留一条规范提交。
