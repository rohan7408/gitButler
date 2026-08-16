import { type GitBranchInfo } from '@git-butler/core';

export function parseBranchForEachRef(output: string): GitBranchInfo[] {
  const lines = output.split('\n').filter((l) => l.trim().length > 0);
  const branches: GitBranchInfo[] = [];

  for (const line of lines) {
    const parts = line.split('|');
    if (parts.length < 5) continue;

    const [name, commitHash, upstreamRaw, trackRaw, headMark] = parts;
    const current = headMark.trim() === '*';
    const upstream = upstreamRaw.trim() || undefined;

    let ahead = 0;
    let behind = 0;
    const aheadMatch = trackRaw.match(/ahead\s+(\d+)/);
    if (aheadMatch) {
      ahead = parseInt(aheadMatch[1], 10);
    }
    const behindMatch = trackRaw.match(/behind\s+(\d+)/);
    if (behindMatch) {
      behind = parseInt(behindMatch[1], 10);
    }

    branches.push({
      name: name.trim(),
      current,
      commitHash: commitHash.trim(),
      upstream,
      ahead,
      behind,
    });
  }

  return branches;
}
