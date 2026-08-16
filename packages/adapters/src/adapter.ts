import { GitButlerMcpServer, type McpCallResult } from '@git-butler/mcp';
import {
  type AgentFormat,
  type AnthropicTool,
  type OpenAITool,
  type RawTool,
  type PromptOptions,
} from './types.js';
import { toAnthropicTools } from './formats/anthropic.js';
import { toOpenAITools, toRawTools } from './formats/openai.js';
import { getAgentSystemPrompt } from './prompts/system.js';

export class AgentToolAdapter {
  constructor(private readonly server: GitButlerMcpServer = new GitButlerMcpServer()) {}

  public getTools(format: 'anthropic'): AnthropicTool[];
  public getTools(format: 'openai'): OpenAITool[];
  public getTools(format: 'raw'): RawTool[];
  public getTools(format: AgentFormat = 'raw'): AnthropicTool[] | OpenAITool[] | RawTool[] {
    const mcpTools = this.server.listTools();
    switch (format) {
      case 'anthropic':
        return toAnthropicTools(mcpTools);
      case 'openai':
        return toOpenAITools(mcpTools);
      case 'raw':
      default:
        return toRawTools(mcpTools);
    }
  }

  public getSystemPrompt(options: PromptOptions = {}): string {
    return getAgentSystemPrompt(options);
  }

  public async executeTool(name: string, args: Record<string, unknown> = {}): Promise<McpCallResult> {
    return this.server.callTool(name, args);
  }

  public async executeAnthropicTool(
    name: string,
    input: Record<string, unknown> = {}
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; is_error?: boolean }> {
    const result = await this.executeTool(name, input);
    return {
      content: result.content,
      is_error: result.isError,
    };
  }

  public async executeOpenAITool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<{ role: 'tool'; name: string; content: string }> {
    const result = await this.executeTool(name, args);
    return {
      role: 'tool',
      name,
      content: result.content.map((c) => c.text).join('\n'),
    };
  }
}

export const defaultAgentToolAdapter = new AgentToolAdapter();
