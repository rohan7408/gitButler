import { describe, it, expect } from 'vitest';
import {
  toAnthropicTools,
  toOpenAITools,
  toRawTools,
  getAgentSystemPrompt,
  AgentToolAdapter,
} from '@git-butler/adapters';
import { GitButlerMcpServer } from '@git-butler/mcp';

describe('Agent Compatibility Layer & Adapters', () => {
  it('Test 1 — formats tools for Anthropic Claude (input_schema)', () => {
    const claudeTools = toAnthropicTools();
    expect(claudeTools.length).toBeGreaterThanOrEqual(18);

    for (const tool of claudeTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
    }

    const taskStart = claudeTools.find((t) => t.name === 'task_start');
    expect(taskStart).toBeDefined();
    expect(taskStart?.input_schema.required).toContain('name');
  });

  it('Test 2 — formats tools for OpenAI / Codex (function calling format)', () => {
    const openAITools = toOpenAITools();
    expect(openAITools.length).toBeGreaterThanOrEqual(18);

    for (const tool of openAITools) {
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBeTruthy();
      expect(tool.function.description).toBeTruthy();
      expect(tool.function.parameters).toBeDefined();
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toBeDefined();
    }

    const gitCommit = openAITools.find((t) => t.function.name === 'git_commit');
    expect(gitCommit).toBeDefined();
    expect(gitCommit?.function.parameters.required).toContain('message');
  });

  it('Test 3 — formats tools for raw JSON schema (OpenCode / Hermes)', () => {
    const rawTools = toRawTools();
    expect(rawTools.length).toBeGreaterThanOrEqual(18);

    for (const tool of rawTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.parameters).toBeDefined();
    }
  });

  it('Test 4 — generates tailored system prompts for all agent archetypes', () => {
    // Claude prompt
    const claudePrompt = getAgentSystemPrompt({
      agentType: 'claude',
      projectName: 'E-Commerce Platform',
      permissionTier: 'REMOTE_INTERACTION',
    });
    expect(claudePrompt).toContain('E-Commerce Platform');
    expect(claudePrompt).toContain('You are the Brain; Git Butler is the Hands');
    expect(claudePrompt).toContain('REMOTE_INTERACTION');
    expect(claudePrompt).toContain('Claude Tool Use Notes');

    // OpenAI prompt
    const openaiPrompt = getAgentSystemPrompt({
      agentType: 'openai',
      projectName: 'Analytics Dashboard',
    });
    expect(openaiPrompt).toContain('Analytics Dashboard');
    expect(openaiPrompt).toContain('OpenAI / Codex Function Calling Notes');

    // Hermes prompt
    const hermesPrompt = getAgentSystemPrompt({
      agentType: 'hermes',
      projectName: 'CLI App',
    });
    expect(hermesPrompt).toContain('Agent Runtime Notes');
  });

  it('Test 5 — executes tool calls through AgentToolAdapter for Anthropic and OpenAI formats', async () => {
    const server = new GitButlerMcpServer();
    const adapter = new AgentToolAdapter(server);

    // 1. Anthropic tool execution
    const anthropicResult = await adapter.executeAnthropicTool('doctor', {});
    expect(anthropicResult.is_error).toBeFalsy();
    expect(anthropicResult.content).toHaveLength(1);
    const doctorReport = JSON.parse(anthropicResult.content[0].text);
    expect(doctorReport.allPassed).toBe(true);

    // 2. OpenAI tool execution
    const openaiResult = await adapter.executeOpenAITool('doctor', {});
    expect(openaiResult.role).toBe('tool');
    expect(openaiResult.name).toBe('doctor');
    const parsedOpenAI = JSON.parse(openaiResult.content);
    expect(parsedOpenAI.allPassed).toBe(true);
  });
});
