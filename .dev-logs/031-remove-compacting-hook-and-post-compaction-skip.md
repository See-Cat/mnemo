# 031 - 移除 compacting 钩子 & compaction 后跳过所有注入

日期: 2026-03-15

## 概要

移除 OpenCode 插件中的 `experimental.session.compacting` 钩子，并在 `experimental.chat.messages.transform` 中新增 compaction 检测逻辑——检测到 compaction 后跳过所有 mnemo 注入。修复 compaction 后记忆丢失问题。

## 背景

### 问题现象

对接 mnemo 后，OpenCode 触发 compaction 会丢失最近的上下文（刚讨论的技术方案、正在进行的 Todo 等）。断开 mnemo 后，同样的 compaction 流程不会丢失内容。

### 根因分析

通过阅读 OpenCode v1.2.25 源码（`compaction.ts`、`prompt.ts`、`message-v2.ts`），定位到两个问题：

**问题 1：`experimental.session.compacting` 钩子干扰 compaction 摘要质量**

mnemo 插件通过此钩子向 compaction prompt 末尾注入了 `<mnemo-compaction>` 提醒文本。但 compaction LLM 调用时 `tools: {}`（无工具可用），agent 无法执行 `memory_save`。这段无效指令稀释了 compaction prompt 的注意力，导致摘要质量下降——LLM 分心去关注"记忆保存"而非"准确概括当前进展"。

**问题 2：`seenSessions` 内存 Set 在特定条件下被清空，导致 compaction 后误注入 search 指令**

mnemo 插件用 `const seenSessions = new Set()` 跟踪已见 session。当以下情况发生时 Set 被清空：

- 用户在 TUI 中修改任何配置（触发 `Instance.disposeAll()` → 插件重新 import）
- OpenCode 进程退出重开
- 收到 SIGUSR2 信号触发 reload

清空后，compaction 后的下一轮被误判为"新 session"，注入 `SESSION_START_REMINDER`（含 `memory_search` 指令），导致 LLM 在已有完整摘要的情况下去调用 search，浪费 token 且可能干扰后续行为。

### OpenCode compaction 流程（源码验证）

1. **触发**：LLM 步骤完成后自动检测、ContextOverflowError、手动 `/compact`
2. **执行**（`compaction.ts:process()`）：将完整对话历史发给 LLM，按 Goal/Instructions/Discoveries/Accomplished/Relevant files 模板生成摘要。`tools: {}`、`system: []`——无工具、无 system prompt
3. **截断**（`message-v2.ts:filterCompacted()`）：从最新消息向旧消息扫描，遇到已完成的 compaction 边界 break。返回 `[compaction user 消息, summary assistant 消息, continue user 消息, ...]`
4. **继续**（`prompt.ts` 循环回顶部）：重新加载消息，进入正常处理路径，无条件调用 `messages.transform`

关键发现：

- compaction user 消息的 parts 中包含 `{ type: "compaction" }`，在 `messages.transform` 中可稳定检测
- compaction 本身不触发 `Instance.dispose()`，不会重载插件
- `messages.transform` 在 compaction 后的正常处理路径中无条件执行

## 实施内容

### 1. 移除 `experimental.session.compacting` 钩子

`src/hooks/reminders.ts`（OPENCODE_PLUGIN_TS 模板）：

- 删除 `COMPACTION_REMINDER` 常量
- 删除 `"experimental.session.compacting"` 钩子函数
- 插件返回的对象只保留 `"experimental.chat.messages.transform"`

### 2. 移除 `REMINDERS.compaction`

`src/hooks/reminders.ts`：从 `REMINDERS` 对象中删除 `compaction` 条目。各 agent 的 compaction hook 横向对比：

| Agent       | Compaction hook                                          | 能力               |
| ----------- | -------------------------------------------------------- | ------------------ |
| OpenCode    | `session.compacting` — 可向 context[] push 或替换 prompt | 已移除             |
| Claude Code | `before_compaction` — void hook                          | 只能观察，不能注入 |
| OpenClaw    | `PreCompact`                                             | 不能注入           |
| Codex       | 同 Claude Code                                           | 只能观察，不能注入 |

除 OpenCode 外，其他 agent 的 compaction hook 均无法注入内容，`REMINDERS.compaction` 没有消费者，属于 dead code。

### 3. Compaction 后跳过所有注入

`src/hooks/reminders.ts`（OPENCODE_PLUGIN_TS 模板）：

`messages.transform` 入口处新增检测：

```typescript
const isPostCompaction = messages.some((m) => m.info?.role === 'user' && m.parts?.some((p) => p.type === 'compaction'));
if (isPostCompaction) return;
```

检测到 compaction 消息后直接 return，不注入 `SESSION_START_REMINDER` 也不注入 `PER_TURN_REMINDER`。让 LLM 干净地基于 compaction 摘要继续工作。

### 3. 同步已部署插件

`~/Desktop/plugins/mnemo-reminder.ts`：与源码模板同步，重启 OpenCode 后立即生效。

## 测试

8 个测试文件，203 个测试全部通过：

| 测试文件               | 测试数 | 变更说明                                                                 |
| ---------------------- | -----: | ------------------------------------------------------------------------ |
| hooks.test.ts          |     40 | "应该处理 compacting 事件" → "不应该处理"；新增 compaction 跳过断言 (+1) |
| templates.test.ts      |     24 | 无变更                                                                   |
| tools.test.ts          |     34 | 无变更                                                                   |
| notes.test.ts          |     35 | 无变更                                                                   |
| config.test.ts         |     23 | 无变更                                                                   |
| embedding.test.ts      |     26 | 无变更                                                                   |
| access-tracker.test.ts |     10 | 无变更                                                                   |
| eviction.test.ts       |     11 | 无变更                                                                   |

## 变更文件清单

```
# 源代码
src/hooks/reminders.ts          # 移除 compacting 钩子；messages.transform 新增 compaction 检测

# 已部署插件
~/Desktop/plugins/mnemo-reminder.ts  # 与源码模板同步

# 测试
tests/hooks.test.ts             # compacting 断言反转 + 新增 compaction 跳过断言
```

## 决策记录

- **移除 compacting 钩子 > 修改注入内容**：compaction LLM 调用无工具可用，注入任何 mnemo 指令都是无效的，且会干扰摘要质量。彻底移除比调整文案更可靠
- **compaction 后跳过所有注入 > 只跳过 session start**：compaction 摘要已包含完整上下文，任何额外注入都可能干扰 LLM 对摘要的理解和续接。保持干净
- **检测 compaction part > 持久化 seenSessions**：用 `parts.some(p => p.type === "compaction")` 检测是确定性的、无状态的，不依赖内存 Set 的生命周期。从根本上避免了插件重载导致的误判问题
- **REMINDERS.compaction 保留未删除**：`REMINDERS` 对象中的 `compaction` 文本仍保留，因为其他 agent 类型（如 Claude Code 的 shell hook）未来可能需要。只是 OpenCode 插件不再使用它
