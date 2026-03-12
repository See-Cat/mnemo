# 024 - Dedup 检测 + type 参数必填

## 改动概要

两个 memory_save 质量提升一起实现：

### 1. Programmatic Dedup Detection

**位置：** `src/core/embedding.ts` + `src/tools/save.ts`

**新增函数：**

```typescript
// embedding.ts
export const DEDUP_SIMILARITY_THRESHOLD = 0.85;

export async function findSimilar(
  content: string,
  threshold: number = DEDUP_SIMILARITY_THRESHOLD,
  topK: number = 3,
): Promise<SimilarNote[]>;
```

**工作流程：**

1. `memory_save` handler 在保存到磁盘**之前**调用 `findSimilar(content)`
2. 如果 embedding 模型未加载完，跳过检查（不阻塞正常保存）
3. 找到相似度 ≥ 0.85 的已有笔记时，保存仍然执行，但返回中附带警告
4. 警告内容包括：相似笔记的 ID、相似度百分比、内容摘要前 100 字符
5. 建议 agent 用 `memory_get` 确认是否重复，或用 `memory_compress` 合并

**设计决策：**

- **不阻止保存，只警告** — 保持 agent 自主权。阻止可能误杀合理的「补充/更新」场景
- **阈值 0.85** — MiniLM-L6-v2 余弦相似度，0.85+ 基本是语义近似或重复
- **dedup 检查失败不影响保存** — best effort，try/catch 包裹

### 2. type 参数改为必填

**变更：**

- `save.ts` 中 `type` 的 zod schema 从 `.optional()` 改为必填
- 移除了 `typeHint`（未指定 type 时的 soft hint）— 不再需要
- `typeLine` 从 `note.meta.type ? ... : ''` 简化为总是显示

**与 prompt 模板一致：**

- `templates.ts` 已经有 "**Always specify a type when saving.**"
- 现在 schema 层面也强制执行

## 测试变更

**`tests/embedding.test.ts`：**

- 新增 `findSimilar` describe，4 个测试用例
  - 相似笔记检测
  - 不相关内容不触发
  - 阈值常量验证
  - 高阈值时返回空数组

**`tests/tools.test.ts`：**

- 新增 2 个 dedup 测试用例（近似重复警告 + 独特内容无警告）
- 移除 1 个旧测试（"未指定 type 时应返回 soft hint"）
- 所有 `memory_save` 调用补充 `type` 参数

**总计：** 162 测试通过（+5 net）

## 文件变更

- `src/core/embedding.ts` — 新增 `findSimilar`、`DEDUP_SIMILARITY_THRESHOLD`、`SimilarNote` 类型
- `src/tools/save.ts` — 加入 dedup 检查、type 改为必填、移除 typeHint
- `tests/embedding.test.ts` — 新增 findSimilar 测试
- `tests/tools.test.ts` — dedup 测试 + type 修复
