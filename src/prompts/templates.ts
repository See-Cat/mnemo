import { type AgentType } from '../core/config.js';

/**
 * Base memory management prompt — shared by all agents.
 */
const BASE_MEMORY_PROMPT = `
## Mnemo - Memory Management

You have access to a persistent memory system (Mnemo). Use it to retain important information across conversations.

### When to save memory (memory_save):
- Key decisions or conclusions reached during discussion
- User preferences, habits, or requirements discovered
- Important context that would be useful in future conversations
- When context window is nearly full, save key information from the current conversation to preserve continuity

### When to search memory (memory_search):
- At the START of each conversation, search for relevant context based on the user's first message
- When the user references past discussions or decisions
- When you need background context for a task
- When the user asks "do you remember..." or similar
- memory_search returns **summaries** — use memory_get with the returned IDs to retrieve full content when needed

### When to get full memory content (memory_get):
- After memory_search, when you need the complete content of specific memories
- Pass one or more note IDs from memory_search results to retrieve full content
- Only retrieve what you actually need — summaries from memory_search are often sufficient

### When to compress memory (memory_compress):
- When you notice the conversation has generated many memory notes
- When explicitly asked to organize or clean up memories
- Periodically during long conversations
- Workflow: call memory_compress to get all notes → distill them into fewer, concise notes → call memory_compress_apply with the distilled notes and old IDs to atomically save new + delete old

### Guidelines:
- Save memories in concise, distilled form - capture the essence, not raw conversation
- Use descriptive tags to categorize memories
- Always include relevant project/topic context in the memory content
- Do not save trivial or temporary information
- When searching, use semantic queries that describe the information you need
`.trim();

/**
 * Agent-specific memory prompt overrides.
 * Appended after the base prompt for agents that need additional instructions.
 */
const AGENT_MEMORY_PROMPTS: Partial<Record<AgentType, string>> = {
    openclaw: `

### OpenClaw Integration:
- After each memory_save, also append the same content to your daily memory file (memory/YYYY-MM-DD.md) to keep OpenClaw's built-in memory in sync
- When you write to daily memory (memory/YYYY-MM-DD.md) or update MEMORY.md, also call memory_save to ensure cross-agent persistence
- During heartbeat memory maintenance (reviewing daily files → updating MEMORY.md), also call memory_compress to consolidate Mnemo memories`,
};

/**
 * Agent-specific configuration file paths
 */
const AGENT_CONFIG: Record<
    AgentType,
    {
        fileName: string;
        globalPath: (home: string) => string;
        projectPath: (cwd: string) => string;
    }
> = {
    opencode: {
        fileName: 'AGENTS.md',
        globalPath: (home) => `${home}/.config/opencode/AGENTS.md`,
        projectPath: (cwd) => `${cwd}/AGENTS.md`,
    },
    'claude-code': {
        fileName: 'CLAUDE.md',
        globalPath: (home) => `${home}/.claude/CLAUDE.md`,
        projectPath: (cwd) => `${cwd}/CLAUDE.md`,
    },
    openclaw: {
        fileName: 'AGENTS.md',
        globalPath: (home) => `${home}/.openclaw/workspace/AGENTS.md`,
        projectPath: (cwd) => `${cwd}/AGENTS.md`,
    },
    codex: {
        fileName: 'AGENTS.md',
        globalPath: (home) => `${home}/.codex/AGENTS.md`,
        projectPath: (cwd) => `${cwd}/AGENTS.md`,
    },
};

/**
 * Marker used to identify Mnemo's section in agent config files
 */
const MARKER_START = '<!-- mnemo:start -->';
const MARKER_END = '<!-- mnemo:end -->';

/**
 * Build the full memory prompt for a given agent type.
 * Falls back to base-only when no agent-specific override exists.
 */
function buildMemoryPrompt(agentType?: AgentType): string {
    const agentPrompt = agentType ? (AGENT_MEMORY_PROMPTS[agentType] ?? '') : '';
    return BASE_MEMORY_PROMPT + agentPrompt;
}

/**
 * Get the prompt block wrapped with markers
 */
export function getPromptBlock(agentType?: AgentType): string {
    return `${MARKER_START}\n${buildMemoryPrompt(agentType)}\n${MARKER_END}`;
}

/**
 * Check if content already has Mnemo prompt injected
 */
export function hasPromptInjected(content: string): boolean {
    return content.includes(MARKER_START);
}

/**
 * Inject or replace Mnemo prompt in content
 */
export function injectPrompt(existingContent: string, agentType?: AgentType): string {
    const block = getPromptBlock(agentType);

    if (hasPromptInjected(existingContent)) {
        // Replace existing block
        const regex = new RegExp(`${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}`, 'g');
        return existingContent.replace(regex, block);
    }

    // Append to end
    const separator = existingContent.trim() ? '\n\n' : '';
    return existingContent.trimEnd() + separator + block + '\n';
}

/**
 * Get config file info for an agent type
 */
export function getAgentConfig(agentType: AgentType) {
    return AGENT_CONFIG[agentType];
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
