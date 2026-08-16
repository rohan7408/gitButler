import { type GitDiffFile, type GitDiffResult } from '@git-butler/core';

export function parseGitDiffNumstat(numstatOutput: string, patchOutput: string = ''): GitDiffResult {
  const lines = numstatOutput.split('\n').filter((l) => l.trim().length > 0);
  const files: GitDiffFile[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const [insRaw, delRaw, filePath] = parts;
    const isBinary = insRaw === '-' && delRaw === '-';
    const insertions = isBinary ? 0 : parseInt(insRaw, 10) || 0;
    const deletions = isBinary ? 0 : parseInt(delRaw, 10) || 0;

    totalInsertions += insertions;
    totalDeletions += deletions;

    files.push({
      path: filePath.trim().replace(/^"|"$/g, ''),
      status: 'M',
      insertions,
      deletions,
      binary: isBinary,
    });
  }

  return {
    files,
    totalInsertions,
    totalDeletions,
    patch: patchOutput,
  };
}
