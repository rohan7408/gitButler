import { type McpToolDefinition, TOOLS } from '@git-butler/mcp';
import { type OpenAITool, type RawTool } from '../types.js';

export function toOpenAITools(tools: McpToolDefinition[] = TOOLS): OpenAITool[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    },
  }));
}

export function toRawTools(tools: McpToolDefinition[] = TOOLS): RawTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required,
    },
  }));
}
