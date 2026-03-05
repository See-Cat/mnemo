# 007 - 发包脚本

**日期：** 2026-03-05

---

## 概要

新增 `scripts/release.sh` 发包脚本，统一发布流程。

## 发布流程（7 步）

1. **检查 Git 工作区** — 确保无未提交改动
2. **检查分支** — 非 main 分支时警告并要求确认
3. **选择版本号** — 交互式选择 patch/minor/major/pre\*，并预览目标版本号
4. **格式化代码** — `prettier --write`，格式化后有改动则中止
5. **回归测试** — `npm test`
6. **构建** — `tsc`
7. **发布** — `npm version`（无 git tag）→ 手动 commit + tag → `npm publish` → `git push + tags`

## 设计决策

- **纯 bash 实现**，无第三方依赖。用 ANSI 颜色码实现步骤可视化
- **版本预览**：用 `npx semver` 计算并显示每个选项对应的目标版本号
- **npm version --no-git-tag-version**：不让 npm 自动 commit/tag，改为手动控制 commit message 格式（`release: vX.Y.Z`）
- **发包成功后才推送 git**：万一 npm publish 失败，本地可以回退（删 tag + reset commit）
- **非 main 分支不拒绝**：只警告并确认，因为开发阶段可能需要从 develop 发 beta 包

## 使用方式

```bash
npm run release
# 或
bash scripts/release.sh
```

## 文件变更

| 文件                 | 变更                  |
| -------------------- | --------------------- |
| `scripts/release.sh` | 新增发包脚本          |
| `package.json`       | 新增 `release` script |
