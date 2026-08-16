#!/usr/bin/env node
import { GitButlerMcpServer } from './server.js';

const server = new GitButlerMcpServer();
server.startStdio().catch((err) => {
  console.error('Fatal error starting Git Butler MCP server:', err);
  process.exit(1);
});
