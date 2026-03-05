# Mnemo

Persistent memory management for AI coding assistants via [MCP](https://modelcontextprotocol.io/).

Mnemo solves the problem of context window overflow — important decisions, user preferences, and project knowledge get lost when conversations reset. Mnemo distills key information into persistent memory notes that can be recalled across sessions using semantic search.

## Features

- **Semantic search** — find memories by meaning, not just keywords (powered by local embeddings)
- **Multi-agent support** — works with OpenCode, Claude Code, Openclaw, and Codex
- **Fully local** — no API calls, no cloud storage; all data stays on your machine
- **Auto-prompted** — injects instructions into your agent's config so it knows when to save and recall memories
- **Compression workflow** — atomic distillation of old notes into fewer, concise ones

## Quick Start

### Install

```bash
npm install -g mnemo
```

### Configure your MCP client

Add Mnemo to your MCP client configuration. For example, in OpenCode (`opencode.json`):

```json
{
  "mcp": {
    "mnemo": {
      "command": "mnemo"
    }
  }
}
```

For Claude Code (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "mnemo": {
      "command": "mnemo"
    }
  }
}
```

### Initialize

Once connected, call the `memory_setup` tool to inject memory management instructions into your agent's config file:

```
> Use the memory_setup tool to initialize Mnemo
```

This writes a prompt block into your agent's config (e.g., `AGENTS.md` for OpenCode, `CLAUDE.md` for Claude Code) that teaches the agent when and how to use Mnemo's tools.

## Tools

Mnemo provides 6 MCP tools:

| Tool                    | Description                                                                 |
| ----------------------- | --------------------------------------------------------------------------- |
| `memory_setup`          | Initialize Mnemo — inject usage instructions into agent config              |
| `memory_save`           | Save a memory note with optional tags and source                            |
| `memory_search`         | Semantic search across memories (supports `source_filter` and `tag_filter`) |
| `memory_compress`       | List all notes for review/distillation                                      |
| `memory_compress_apply` | Atomically save distilled notes and delete originals                        |
| `memory_delete`         | Delete notes by ID                                                          |

## How It Works

### Storage

Memory notes are stored as Markdown files with YAML frontmatter:

```
~/Library/Application Support/mnemo/    # macOS
~/.local/share/mnemo/                   # Linux
%APPDATA%/mnemo/                        # Windows
├── notes/                              # Markdown files
│   ├── 20260305-172200-a3f1.md
│   └── 20260305-183015-b7c2.md
└── index/                              # Vector index (vectra)
```

Override the data directory with `MNEMO_DATA_DIR` environment variable.

### Semantic Search

Mnemo uses [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (33MB, 384 dimensions) for local embeddings via `@huggingface/transformers`. The model is preloaded at server startup so it's ready before the first search.

### Memory Lifecycle

1. **Save** — Agent saves key info during conversations (decisions, preferences, architecture choices, or when context is running low)
2. **Search** — Agent retrieves relevant context at the start of new conversations or when needed
3. **Compress** — When notes accumulate, the agent distills them into fewer, concise notes via `memory_compress` → review → `memory_compress_apply`

## Development

```bash
git clone git@github.com:See-Cat/mnemo.git
cd mnemo
npm install
npm run build
npm test
```

### Scripts

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `npm run build`        | Compile TypeScript           |
| `npm run dev`          | Watch mode compilation       |
| `npm test`             | Run tests (Vitest)           |
| `npm run test:watch`   | Watch mode tests             |
| `npm run prettier:fix` | Format all files             |
| `npm run release`      | Interactive release workflow |

### Release

```bash
npm run release
```

Interactive script that walks through: git check → branch check → version selection → format → test → build → publish → push.

## License

MIT
