import { type McpToolDefinition, TOOLS } from '@git-butler/mcp';
import { type AnthropicTool } from '../types.js';

export function toAnthropicTools(tools: McpToolDefinition[] = TOOLS): AnthropicTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required,
    },
  }));
}
