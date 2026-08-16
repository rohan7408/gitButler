import { describe, it, expect } from 'vitest';
import {
  parseGitStatus,
  parseBranchForEachRef,
  parseGitLog,
  parseGitDiffNumstat,
} from '@git-butler/git';

describe('Git Output Parsers', () => {
  describe('parseGitStatus', () => {
    it('parses a clean status with upstream tracking', () => {
      const output = '## main...origin/main [ahead 2, behind 1]\n';
      const result = parseGitStatus(output);
      expect(result.isClean).toBe(true);
      expect(result.currentBranch).toBe('main');
      expect(result.trackingBranch).toBe('origin/main');
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(1);
      expect(result.files).toHaveLength(0);
    });

    it('parses staged, unstaged, untracked, and renamed files', () => {
      const output = [
        '## feature/test',
        'M  staged_file.ts',
        ' M unstaged_file.ts',
        'MM both_modified.ts',
        'A  added_file.ts',
        'D  deleted_file.ts',
        'R  old.ts -> new.ts',
        '?? untracked.ts',
      ].join('\n');

      const result = parseGitStatus(output);
      expect(result.isClean).toBe(false);
      expect(result.currentBranch).toBe('feature/test');
      expect(result.files).toHaveLength(7);

      const staged = result.files.find((f) => f.path === 'staged_file.ts');
      expect(staged?.staged).toBe(true);
      expect(staged?.unstaged).toBe(false);

      const unstaged = result.files.find((f) => f.path === 'unstaged_file.ts');
      expect(unstaged?.staged).toBe(false);
      expect(unstaged?.unstaged).toBe(true);

      const both = result.files.find((f) => f.path === 'both_modified.ts');
      expect(both?.staged).toBe(true);
      expect(both?.unstaged).toBe(true);

      const renamed = result.files.find((f) => f.path === 'new.ts');
      expect(renamed?.origPath).toBe('old.ts');

      const untracked = result.files.find((f) => f.path === 'untracked.ts');
      expect(untracked?.untracked).toBe(true);
    });
  });

  describe('parseBranchForEachRef', () => {
    it('parses branch records correctly', () => {
      const output = [
        'main|e87b21a6f8b|origin/main|[ahead 1]|*',
        'feature/order-page|99a12c8b7e|||',
      ].join('\n');

      const branches = parseBranchForEachRef(output);
      expect(branches).toHaveLength(2);

      const main = branches.find((b) => b.name === 'main');
      expect(main?.current).toBe(true);
      expect(main?.commitHash).toBe('e87b21a6f8b');
      expect(main?.upstream).toBe('origin/main');
      expect(main?.ahead).toBe(1);

      const feature = branches.find((b) => b.name === 'feature/order-page');
      expect(feature?.current).toBe(false);
      expect(feature?.commitHash).toBe('99a12c8b7e');
    });
  });

  describe('parseGitLog', () => {
    it('parses structured commit log', () => {
      const record1 = [
        'e87b21a6f8b12345678901234567890123456789',
        'e87b21a',
        'Alice Dev',
        'alice@example.com',
        '2026-08-16T12:00:00Z',
        'feat: add order page',
        '1111111 2222222',
      ].join('\x1f');

      const output = `${record1}\x1e`;
      const commits = parseGitLog(output);

      expect(commits).toHaveLength(1);
      expect(commits[0].hash).toBe('e87b21a6f8b12345678901234567890123456789');
      expect(commits[0].shortHash).toBe('e87b21a');
      expect(commits[0].authorName).toBe('Alice Dev');
      expect(commits[0].authorEmail).toBe('alice@example.com');
      expect(commits[0].message).toBe('feat: add order page');
      expect(commits[0].parents).toEqual(['1111111', '2222222']);
    });
  });

  describe('parseGitDiffNumstat', () => {
    it('parses diff additions and deletions', () => {
      const numstat = '12\t4\tsrc/order.ts\n-\t-\tassets/logo.png\n';
      const patch = 'diff --git a/src/order.ts b/src/order.ts...';
      const diff = parseGitDiffNumstat(numstat, patch);

      expect(diff.files).toHaveLength(2);
      expect(diff.totalInsertions).toBe(12);
      expect(diff.totalDeletions).toBe(4);
      expect(diff.files[0].path).toBe('src/order.ts');
      expect(diff.files[0].insertions).toBe(12);
      expect(diff.files[0].deletions).toBe(4);
      expect(diff.files[1].path).toBe('assets/logo.png');
      expect(diff.files[1].binary).toBe(true);
      expect(diff.patch).toBe(patch);
    });
  });
});
