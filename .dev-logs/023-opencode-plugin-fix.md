# 023 - OpenCode 插件修复：隐形消息注入

## 背景

OpenCode 插件（`mnemo-reminder.ts`）存在两个严重问题：

1. **`session.idle` 触发过于频繁** — 该事件在每次 AI 回复后都会触发，而非仅在会话结束时。导致每条消息后都出现 `<mnemo-session-end>` 文本。
2. **`client.session.prompt()` 创建可见消息** — 提醒文本直接暴露给用户，体验极差。

## 调研发现

### OpenCode 插件钩子 API

通过查阅 OpenCode 官方文档和源码，确认以下关键信息：

- **`experimental.chat.messages.transform`** — 在消息发送给 LLM 之前触发，可修改消息内容但对用户**不可见**
  - 签名：`(input: {}, output: { messages: { info: Message, parts: Part[] }[] }) => Promise<void>`
  - 通过 mutation 修改 `output.messages`
- **`chat.message`** — 类似但修改**对用户可见**
- **`experimental.session.compacting`** — 已在用，正常工作

### 关键类型

```typescript
Message = UserMessage | AssistantMessage
Part = TextPart | ToolPart | ReasoningPart | ... (discriminated union)
```

所有钩子遵循统一模式：`(input, output) => Promise<void>`，input 只读，output 可变。

## 修复方案

### 核心改动

**移除：**

- `event` 处理器（`session.created` + `session.idle`）
- 所有 `client.session.prompt()` 调用
- `SESSION_END_REMINDER` 引用
- `{ client }` 参数依赖

**新增：**

- `experimental.chat.messages.transform` 钩子实现隐形注入
- `seenSessions` Set 跟踪已见会话，区分首次/后续
- 首次消息注入 `SESSION_START_REMINDER`（含搜索记忆 + 自检）
- 后续消息注入 `PER_TURN_REMINDER`（仅自检）

### 插件结构（修复后）

```typescript
export const MnemoReminder = async () => {
  return {
    'experimental.chat.messages.transform': async (_input, output) => {
      // 找到最后一条用户消息，追加提醒到其 parts 数组
      // 新会话 → SESSION_START_REMINDER
      // 后续轮次 → PER_TURN_REMINDER
    },
    'experimental.session.compacting': async (_input, output) => {
      output.context.push(COMPACTION_REMINDER);
    },
  };
};
```

### 设计优势

1. **完全隐形** — transform 钩子的修改不会显示给用户
2. **无需 SDK client** — 不再调用 `client.session.prompt()`，消除了可见消息问题
3. **精确的频率控制** — 每次 LLM 调用恰好注入一次，不会像 `session.idle` 那样重复触发
4. **会话感知** — 通过 sessionID 跟踪区分新会话和后续轮次

## 测试更新

更新了 `tests/hooks.test.ts` 中 OpenCode 插件模板的测试用例：

**移除的检查：**

- `session.created`、`session.idle`、`noReply: true`

**新增的检查：**

- `experimental.chat.messages.transform` 存在
- `seenSessions` 会话跟踪逻辑
- 不包含 `client.session.prompt`（旧方式）
- 不包含 `session.idle`（频繁触发）
- 区分 `SESSION_START_REMINDER` 和 `PER_TURN_REMINDER`
- 不需要 `{ client }` 参数

全部 157 测试通过。

## 文件变更

- `src/hooks/reminders.ts` — 重写 `OPENCODE_PLUGIN_TS` 模板
- `tests/hooks.test.ts` — 更新 OpenCode 插件测试用例
- `~/.config/opencode/plugins/mnemo-reminder.ts` — 更新已安装的插件（立即生效）

## 四种 Agent 钩子策略（更新后）

| Agent       | 机制                                 | 触发频率              | 状态          |
| ----------- | ------------------------------------ | --------------------- | ------------- |
| Claude Code | Shell script UserPromptSubmit        | 每轮                  | ✅            |
| Codex       | Shell script UserPromptSubmit        | 每轮                  | ✅            |
| OpenClaw    | agent:bootstrap handler.ts           | 会话开始              | ✅            |
| OpenCode    | experimental.chat.messages.transform | 每次 LLM 调用（隐形） | ✅ **已修复** |
