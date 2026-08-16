import { type AgentType } from '@git-butler/core';

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface RawTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type AgentFormat = 'anthropic' | 'openai' | 'raw';

export interface PromptOptions {
  agentType?: AgentType;
  projectName?: string;
  worktreeDir?: string;
  permissionTier?: string;
}
