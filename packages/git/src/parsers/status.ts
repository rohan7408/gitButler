import { type GitFileStatus, type GitStatusResult } from '@git-butler/core';

export function parseGitStatus(output: string): GitStatusResult {
  const lines = output.split('\n').filter((l) => l.trim().length > 0);

  let currentBranch: string | undefined;
  let trackingBranch: string | undefined;
  let ahead = 0;
  let behind = 0;
  const files: GitFileStatus[] = [];

  for (const line of lines) {
    if (line.startsWith('##')) {
      // Branch header: ## branchName...trackingBranch [ahead X, behind Y]
      // or: ## Initial commit on branchName
      // or: ## No commits yet on branchName
      // or: ## HEAD (no branch)
      const headerContent = line.substring(2).trim();

      if (headerContent.startsWith('Initial commit on ') || headerContent.startsWith('No commits yet on ')) {
        currentBranch = headerContent.replace(/^(Initial commit on |No commits yet on )/, '').trim();
      } else if (headerContent.startsWith('HEAD (no branch)')) {
        currentBranch = undefined; // detached HEAD
      } else {
        const branchPart = headerContent.split(' ')[0]; // e.g. "main...origin/main" or "main"
        if (branchPart.includes('...')) {
          const [local, remote] = branchPart.split('...');
          currentBranch = local;
          trackingBranch = remote;
        } else {
          currentBranch = branchPart;
        }

        // Ahead/behind tracking
        const aheadMatch = headerContent.match(/ahead\s+(\d+)/);
        if (aheadMatch) {
          ahead = parseInt(aheadMatch[1], 10);
        }
        const behindMatch = headerContent.match(/behind\s+(\d+)/);
        if (behindMatch) {
          behind = parseInt(behindMatch[1], 10);
        }
      }
      continue;
    }

    if (line.length < 3) continue;

    const x = line[0];
    const y = line[1];
    let filePath = line.substring(3).trim();
    let origPath: string | undefined;

    // Handle renamed files "R  newpath -> oldpath" or "newpath -> oldpath"
    if (filePath.includes(' -> ')) {
      const parts = filePath.split(' -> ');
      filePath = parts[1].replace(/^"|"$/g, '');
      origPath = parts[0].replace(/^"|"$/g, '');
    } else {
      filePath = filePath.replace(/^"|"$/g, '');
    }

    const untracked = x === '?' && y === '?';
    const staged = !untracked && x !== ' ';
    const unstaged = !untracked && y !== ' ';

    files.push({
      path: filePath,
      origPath,
      indexStatus: x,
      workingTreeStatus: y,
      staged,
      unstaged,
      untracked,
    });
  }

  const isClean = files.length === 0;

  return {
    isClean,
    currentBranch,
    trackingBranch,
    ahead,
    behind,
    files,
  };
}
