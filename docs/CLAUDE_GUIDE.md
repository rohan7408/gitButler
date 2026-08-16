# Git Butler — Anthropic Claude Integration Guide

This guide explains how to integrate Git Butler tools directly into applications using the Anthropic TypeScript / Python SDKs.

---

## 1. Using `@git-butler/adapters` with Anthropic SDK

`@git-butler/adapters` exports `toAnthropicTools()` and `AgentToolAdapter` to format Git Butler tools into Anthropic's expected tool calling format (`input_schema`).

### Example: Node.js / TypeScript Integration

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { toAnthropicTools, getAgentSystemPrompt, AgentToolAdapter } from '@git-butler/adapters';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const adapter = new AgentToolAdapter();
const tools = toAnthropicTools();
const systemPrompt = getAgentSystemPrompt({
  agentType: 'claude',
  projectName: 'My Application',
  permissionTier: 'LOCAL_MUTATION',
});

async function runAgent(userPrompt: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userPrompt }
  ];

  let response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt,
    tools: tools as Anthropic.Tool[],
    messages,
  });

  // Handle Tool Calls
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter((c) => c.type === 'tool_use');
    
    // Add Assistant message with tool uses
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type === 'tool_use') {
        const result = await adapter.executeAnthropicTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.content[0].text,
          is_error: result.is_error,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    });
  }

  console.log(response.content);
}
```

---

## 2. Recommended Claude Workflow Rules

When pairing with Claude, the following workflow provides maximum safety:

1. **Task Initialization:** Claude calls `task_start({ name: "Feature Name" })`.
2. **Worktree Coding:** Claude writes code strictly inside the returned `worktreePath`.
3. **Checkpoints:** Claude snapshots with `checkpoint_create()` before editing existing modules.
4. **Verification Gate:** Claude calls `task_verify({ taskId })` before claiming work is finished.
5. **PR Creation:** Claude opens a pull request with `pr_create()`.
