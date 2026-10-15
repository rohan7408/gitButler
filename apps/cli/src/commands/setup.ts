import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Command } from 'commander';
import pc from 'picocolors';

export interface SetupOptions {
  cursor?: boolean;
  antigravity?: boolean;
  claude?: boolean;
  windsurf?: boolean;
  global?: boolean;
  all?: boolean;
  path?: string;
  C?: string;
}

const MCP_ENTRY = {
  command: 'npx',
  args: ['-y', '@rohan7/git-butler', 'mcp'],
};

function getClaudeConfigPath(): string {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Claude', 'claude_desktop_config.json');
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

function getAntigravityConfigPaths(): string[] {
  return [
    path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
    path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json'),
  ];
}

function getWindsurfConfigPath(): string {
  return path.join(os.homedir(), '.codeium', 'windsurf', 'mcp_config.json');
}

function getUniversalGlobalConfigPaths(): string[] {
  return [
    path.join(os.homedir(), '.mcp.json'),
    path.join(os.homedir(), '.config', 'mcp', 'config.json'),
  ];
}

function mergeMcpConfig(targetFilePath: string): void {
  const targetDir = path.dirname(targetFilePath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let config: Record<string, any> = { mcpServers: {} };
  if (fs.existsSync(targetFilePath)) {
    try {
      const raw = fs.readFileSync(targetFilePath, 'utf-8');
      config = JSON.parse(raw);
    } catch {
      config = { mcpServers: {} };
    }
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  config.mcpServers['git-butler'] = MCP_ENTRY;

  fs.writeFileSync(targetFilePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function createSetupCommand(): Command {
  const setup = new Command('setup')
    .description('Configure Git Butler MCP in your AI coding assistant (interactive or via flags)')
    .option('-g, --global', 'Install universal global MCP config (~/.mcp.json) for all tools and projects')
    .option('--cursor', 'Configure for Cursor IDE (.cursor/mcp.json in current project)')
    .option('--antigravity', 'Configure for Google Antigravity')
    .option('--claude', 'Configure for Anthropic Claude Desktop')
    .option('--windsurf', 'Configure for Windsurf Editor')
    .option('--all', 'Configure for all supported AI assistants and global locations')
    .option('-C <path>', 'Current working directory (for project-level configs)', process.cwd())
    .action(async (options: SetupOptions) => {
      const cwd = options.C ? path.resolve(options.C) : (options.path ? path.resolve(options.path) : process.cwd());
      const hasSpecificFlag = options.cursor || options.antigravity || options.claude || options.windsurf || options.global || options.all;

      let selectedChoices: number[] = [];

      console.log(pc.cyan(pc.bold('\n🎩 Git Butler — AI Assistant Setup\n')));

      if (!hasSpecificFlag && process.stdin.isTTY) {
        // Interactive mode: ask user to choose
        console.log('Select which AI assistants / environments to configure:\n');
        console.log(`  ${pc.bold('[1]')} 🎯 Cursor IDE ${pc.dim('(.cursor/mcp.json in this project)')}`);
        console.log(`  ${pc.bold('[2]')} 🪐 Google Antigravity ${pc.dim('(~/.gemini/antigravity/mcp_config.json)')}`);
        console.log(`  ${pc.bold('[3]')} 🤖 Claude Desktop ${pc.dim('(claude_desktop_config.json)')}`);
        console.log(`  ${pc.bold('[4]')} 🌊 Windsurf Editor ${pc.dim('(~/.codeium/windsurf/mcp_config.json)')}`);
        console.log(`  ${pc.bold('[5]')} 🌐 Universal Global Config ${pc.dim('(~/.mcp.json - works everywhere)')}`);
        console.log(`  ${pc.bold('[6]')} 🌟 All of the above ${pc.dim('(Global + all detected IDEs)')}\n`);

        const rl = readline.createInterface({ input, output });
        try {
          const answer = await rl.question(pc.yellow('Enter choice numbers separated by comma (e.g. 1, 5 or 6): '));
          rl.close();

          const parts = answer.split(',').map((p) => parseInt(p.trim(), 10)).filter((n) => !isNaN(n));
          selectedChoices = parts.length > 0 ? parts : [6]; // Default to all if empty enter
        } catch {
          rl.close();
          selectedChoices = [6];
        }
        console.log();
      }

      const isAll = options.all || selectedChoices.includes(6);
      const isCursor = isAll || options.cursor || selectedChoices.includes(1);
      const isAntigravity = isAll || options.antigravity || selectedChoices.includes(2);
      const isClaude = isAll || options.claude || selectedChoices.includes(3);
      const isWindsurf = isAll || options.windsurf || selectedChoices.includes(4);
      const isGlobal = isAll || options.global || selectedChoices.includes(5);

      const configuredTargets: string[] = [];

      // 1. Cursor IDE
      if (isCursor) {
        const cursorConfigPath = path.join(cwd, '.cursor', 'mcp.json');
        mergeMcpConfig(cursorConfigPath);
        configuredTargets.push(`Cursor IDE (${pc.dim(cursorConfigPath)})`);
      }

      // 2. Google Antigravity
      if (isAntigravity) {
        const agPaths = getAntigravityConfigPaths();
        for (const agPath of agPaths) {
          mergeMcpConfig(agPath);
          configuredTargets.push(`Google Antigravity (${pc.dim(agPath)})`);
        }
      }

      // 3. Claude Desktop
      if (isClaude) {
        const claudePath = getClaudeConfigPath();
        mergeMcpConfig(claudePath);
        configuredTargets.push(`Claude Desktop (${pc.dim(claudePath)})`);
      }

      // 4. Windsurf
      if (isWindsurf) {
        const windsurfPath = getWindsurfConfigPath();
        mergeMcpConfig(windsurfPath);
        configuredTargets.push(`Windsurf (${pc.dim(windsurfPath)})`);
      }

      // 5. Universal Global Config (~/.mcp.json)
      if (isGlobal) {
        const globalPaths = getUniversalGlobalConfigPaths();
        for (const gPath of globalPaths) {
          mergeMcpConfig(gPath);
          configuredTargets.push(`Universal Global Config (${pc.dim(gPath)})`);
        }
      }

      // Fallback if somehow nothing was selected
      if (configuredTargets.length === 0) {
        const fallbackPath = path.join(os.homedir(), '.mcp.json');
        mergeMcpConfig(fallbackPath);
        configuredTargets.push(`Universal Global Config (${pc.dim(fallbackPath)})`);
      }

      for (const target of configuredTargets) {
        console.log(`  ${pc.green('✓')} Configured for ${target}`);
      }

      console.log(pc.bold(pc.green('\n✨ Done! Git Butler MCP server is ready.')));
      console.log(pc.dim('Restart your AI assistant/chat window and Git Butler will be available automatically.\n'));
    });

  return setup;
}
