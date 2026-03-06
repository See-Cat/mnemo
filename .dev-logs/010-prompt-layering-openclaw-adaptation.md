# 010 - 提示词分层架构 + OpenClaw 适配

## 背景

OpenClaw 有自己的三层内置记忆系统（MEMORY.md / daily memory / session records），但实际效果很差——daily memory 只记录早期部分，后续基本不记忆，导致第二天"断片"。

之前 mnemo 对所有 agent 使用同一套 `MEMORY_PROMPT`，在 OpenClaw 中注入后与其内置记忆指令冲突，agent 优先执行内置指令而忽略 mnemo。

## 分析

### OpenClaw 记忆系统三层分析

| 层级                   | 文件                                         | 触发机制                                | 问题                                     |
| ---------------------- | -------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| Session 启动（读）     | SOUL.md, USER.md, MEMORY.md, 当日+昨日 daily | 每次 session 开始自动读取               | 只读不写，读取机制本身没问题             |
| Daily memory（实时写） | memory/YYYY-MM-DD.md                         | "Capture what matters" — 无明确触发条件 | 触发太模糊，agent 容易在对话中段就不记了 |
| 长期记忆（提炼）       | MEMORY.md                                    | Heartbeat 期间定期回顾 daily 文件       | 依赖 heartbeat，几天才触发一次           |

### 核心结论

- OpenClaw 的记忆问题在**写入侧**，不在读取侧
- mnemo 应该做**写入层的补位** + **读取层的补充**（跨 agent 记忆）
- 不应该替代 OpenClaw 内置记忆，而是融合互补

## 设计决策

### 提示词分层架构

将 `MEMORY_PROMPT` 拆分为两层：

- **Base prompt** — 所有 agent 通用的记忆使用原则
- **Agent adaptation** — 针对特定 agent 的适配层（目前只有 OpenClaw 需要）

`getPromptBlock(agentType?)` 根据 agentType 拼接：有适配层就追加，没有就只用 base。

### Base prompt 调整

相比 v1.1.0 的 MEMORY_PROMPT，去掉了两条编程味过重的触发条件：

- ~~"Technical architecture or design choices"~~
- ~~"Task outcomes and lessons learned"~~

这些被更通用的 "Key decisions or conclusions" 和 "Important context" 覆盖。

### OpenClaw 适配层

三条规则，覆盖三层记忆系统的融合：

1. **mnemo → daily memory 同步**：每次 `memory_save` 后，也追加到 `memory/YYYY-MM-DD.md`
2. **daily memory → mnemo 同步**：写入 daily memory 或更新 MEMORY.md 时，也调用 `memory_save`
3. **Heartbeat 双向整理**：heartbeat 回顾 daily files 时，同步调用 `memory_compress`

## 代码改动

### `src/prompts/templates.ts`

- `MEMORY_PROMPT` → `BASE_MEMORY_PROMPT`（去掉编程专属触发条件）
- 新增 `AGENT_MEMORY_PROMPTS` 对象（`Partial<Record<AgentType, string>>`），目前只有 `openclaw` 条目
- 新增 `buildMemoryPrompt(agentType?)` 内部函数，拼接 base + agent 适配
- `getPromptBlock(agentType?)` 和 `injectPrompt(content, agentType?)` 增加可选参数

### `src/tools/setup.ts`

- `injectPrompt` 调用处传入 `agentType`

### `tests/templates.test.ts`

- 新增 6 个测试：
  - 无 agentType 时只包含 base
  - 非 openclaw agent 只包含 base
  - openclaw 包含 base + 适配层
  - openclaw 注入包含适配层内容
  - 非 openclaw 注入不包含适配层
  - 替换时保留适配层

## 测试结果

75 个测试全部通过（69 → 75，新增 6 个）。
