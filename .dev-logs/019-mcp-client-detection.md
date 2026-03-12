# 019 - MCP 协议级 Agent 类型检测

## 背景

`memory_setup` 工具在未指定 `agent_type` 参数时，需要自动检测当前使用的 agent 类型。之前的实现 `detectAgentType()` 通过检查文件系统中的 agent 配置文件来判断（如 `opencode.json`、`CLAUDE.md`、`openclaw.json` 等）。

**问题**：文件检测按固定顺序执行，在安装了多个 agent 的机器上，第一个匹配的 agent 会"赢"。例如用户同时安装了 OpenCode 和 OpenClaw，从 OpenClaw 调用 `memory_setup` 时，由于 `opencode.json` 在检查顺序中排在前面，会被误检测为 OpenCode。

## 解决方案

MCP 协议的 `initialize` 握手阶段，客户端会发送 `clientInfo: Implementation`（包含 `name` 和 `version`），这是权威的客户端标识。

### 技术发现

- `McpServer`（高层 API）通过 `server` 属性（`public readonly`）暴露底层 `Server` 实例
- `Server.getClientVersion()` 返回 `Implementation | undefined`
- 在工具处理函数中可通过 `mcpServer.server.getClientVersion()` 获取
- `_clientVersion` 在 `initialize` 握手期间填充，工具调用时一定已可用

### 各 Agent 的 clientInfo.name

| Agent       | clientInfo.name       |
| ----------- | --------------------- |
| OpenCode    | `opencode`            |
| Claude Code | `claude-code`         |
| OpenClaw    | `openclaw-acp-client` |
| Codex       | `codex-mcp-client`    |

### 检测优先级

1. **显式参数** `agent_type`（用户明确指定，最高优先级）
2. **MCP 协议** `clientInfo.name`（握手信息，权威且不受文件系统影响）
3. **文件检测**（回退方案，保留原有逻辑）

## 实现

### config.ts

新增 `CLIENT_NAME_MAP: Record<string, AgentType>`，将 MCP 客户端名映射到 AgentType。

### setup.ts

- 原 `detectAgentType()` 重命名为 `detectAgentTypeFromFiles()`（文件检测回退）
- 新增 `detectAgentTypeFromClient(server: McpServer)`（MCP 协议检测）
- 工具处理函数中按优先级调用：explicit param → MCP client → file fallback

### 测试

新增 10 个测试（6 个 config + 4 个 tools）：

**config.test.ts** (6 tests):

- CLIENT_NAME_MAP 包含 4 个映射
- 各客户端名正确映射
- 未知客户端名返回 undefined

**tools.test.ts** (4 tests):

- MCP clientInfo.name 为 `opencode` 时自动检测为 opencode
- MCP clientInfo.name 为 `openclaw-acp-client` 时自动检测为 openclaw
- 未知 clientInfo.name 且无文件标记时报错
- 显式 agent_type 参数优先于 MCP 检测

测试总数：118（从 108 增至 118）

## 文件变更

- `src/core/config.ts` — 新增 `CLIENT_NAME_MAP`
- `src/tools/setup.ts` — 重构检测逻辑，MCP 优先 + 文件回退
- `tests/config.test.ts` — 新增 CLIENT_NAME_MAP 测试
- `tests/tools.test.ts` — 新增 MCP 协议级检测测试
