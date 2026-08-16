import { type GitCommitInfo } from '@git-butler/core';

export const LOG_FORMAT = '%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%P%x1e';

export function parseGitLog(output: string): GitCommitInfo[] {
  if (!output.trim()) return [];

  const records = output.split('\x1e').filter((r) => r.trim().length > 0);
  const commits: GitCommitInfo[] = [];

  for (const record of records) {
    const fields = record.trim().split('\x1f');
    if (fields.length < 7) continue;

    const [hash, shortHash, authorName, authorEmail, date, message, parentsRaw] = fields;
    const parents = parentsRaw.trim() ? parentsRaw.trim().split(' ') : [];

    commits.push({
      hash: hash.trim(),
      shortHash: shortHash.trim(),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
      date: date.trim(),
      message: message.trim(),
      parents,
    });
  }

  return commits;
}
