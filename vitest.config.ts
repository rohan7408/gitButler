import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/**/*.test.ts'],
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      '@git-butler/core': path.resolve(__dirname, 'packages/core/src'),
      '@git-butler/git': path.resolve(__dirname, 'packages/git/src'),
      '@git-butler/worktrees': path.resolve(__dirname, 'packages/worktrees/src'),
      '@git-butler/tasks': path.resolve(__dirname, 'packages/tasks/src'),
      '@git-butler/checkpoints': path.resolve(__dirname, 'packages/checkpoints/src'),
      '@git-butler/verification': path.resolve(__dirname, 'packages/verification/src'),
      '@git-butler/permissions': path.resolve(__dirname, 'packages/permissions/src'),
      '@git-butler/github': path.resolve(__dirname, 'packages/github/src'),
      '@git-butler/mcp': path.resolve(__dirname, 'packages/mcp/src'),
      '@git-butler/adapters': path.resolve(__dirname, 'packages/adapters/src'),
    },
  },
});
