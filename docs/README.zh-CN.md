# Mnemo

通过 [MCP](https://modelcontextprotocol.io/) 为 AI 编程助手提供持久化记忆管理。

Mnemo 解决的是 context window 溢出导致记忆丢失的问题——重要的决策、用户偏好和项目知识会在对话重置时消失。Mnemo 将关键信息蒸馏为持久化的记忆笔记，可通过语义搜索在不同会话间检索。

## 特性

- **语义搜索** — 按含义而非关键词查找记忆（基于本地嵌入模型）
- **多 Agent 支持** — 适配 OpenCode、Claude Code、Openclaw 和 Codex
- **完全本地化** — 无 API 调用，无云存储，所有数据留在你的机器上
- **自动提示注入** — 向 Agent 配置文件注入使用指令，让 Agent 知道何时保存和检索记忆
- **压缩工作流** — 原子性地将旧笔记蒸馏为更少、更精炼的笔记

## 快速开始

### 安装

```bash
npm install -g mnemo
```

### 配置 MCP 客户端

将 Mnemo 添加到你的 MCP 客户端配置。以 OpenCode（`opencode.json`）为例：

```json
{
  "mcp": {
    "mnemo": {
      "command": "mnemo"
    }
  }
}
```

Claude Code（`.claude/settings.json`）：

```json
{
  "mcpServers": {
    "mnemo": {
      "command": "mnemo"
    }
  }
}
```

### 初始化

连接后，调用 `memory_setup` 工具将记忆管理指令注入 Agent 配置文件：

```
> 使用 memory_setup 工具初始化 Mnemo
```

这会在 Agent 配置文件中写入一段提示（如 OpenCode 的 `AGENTS.md`、Claude Code 的 `CLAUDE.md`），告诉 Agent 何时以及如何使用 Mnemo 的工具。

## 工具

Mnemo 提供 6 个 MCP 工具：

| 工具                    | 说明                                                 |
| ----------------------- | ---------------------------------------------------- |
| `memory_setup`          | 初始化 Mnemo — 向 Agent 配置文件注入使用指令         |
| `memory_save`           | 保存记忆笔记，可附带标签和来源                       |
| `memory_search`         | 语义搜索记忆（支持 `source_filter` 和 `tag_filter`） |
| `memory_compress`       | 列出所有笔记供审阅/蒸馏                              |
| `memory_compress_apply` | 原子性地保存蒸馏笔记并删除原始笔记                   |
| `memory_delete`         | 按 ID 删除笔记                                       |

## 工作原理

### 存储

记忆笔记以 Markdown 文件存储，包含 YAML frontmatter 元数据：

```
~/Library/Application Support/mnemo/    # macOS
~/.local/share/mnemo/                   # Linux
%APPDATA%/mnemo/                        # Windows
├── notes/                              # Markdown 文件
│   ├── 20260305-172200-a3f1.md
│   └── 20260305-183015-b7c2.md
└── index/                              # 向量索引（vectra）
```

可通过 `MNEMO_DATA_DIR` 环境变量覆盖数据目录。

### 语义搜索

Mnemo 使用 [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)（33MB，384 维）通过 `@huggingface/transformers` 在本地生成嵌入向量。模型在服务启动时预加载，确保首次搜索前就绪。

### 记忆生命周期

1. **保存** — Agent 在对话中保存关键信息（决策、偏好、架构选择，或 context 即将耗尽时）
2. **搜索** — Agent 在新对话开始时或需要时检索相关上下文
3. **压缩** — 当笔记积累过多时，Agent 通过 `memory_compress` → 审阅蒸馏 → `memory_compress_apply` 将笔记精炼合并

## 开发

```bash
git clone git@github.com:See-Cat/mnemo.git
cd mnemo
npm install
npm run build
npm test
```

### 命令

| 命令                   | 说明               |
| ---------------------- | ------------------ |
| `npm run build`        | 编译 TypeScript    |
| `npm run dev`          | 监听模式编译       |
| `npm test`             | 运行测试（Vitest） |
| `npm run test:watch`   | 监听模式测试       |
| `npm run prettier:fix` | 格式化所有文件     |
| `npm run release`      | 交互式发布流程     |

### 发布

```bash
npm run release
```

交互式脚本，依次执行：Git 检查 → 分支确认 → 版本选择 → 格式化 → 测试 → 构建 → 发布 → 推送。

## 许可证

MIT
