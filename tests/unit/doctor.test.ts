import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { runDoctorChecks } from '@git-butler/git';
import { DoctorReportSchema } from '@git-butler/core';

describe('Doctor Diagnostics', () => {
  it('runs doctor diagnostics in the current repository and returns valid schema report', async () => {
    const report = await runDoctorChecks(process.cwd());
    const parseResult = DoctorReportSchema.safeParse(report);
    expect(parseResult.success).toBe(true);

    const checkNames = report.checks.map((c) => c.name);
    expect(checkNames).toContain('Node.js Runtime');
    expect(checkNames).toContain('Git Binary');
    expect(checkNames).toContain('Git Version');
    expect(checkNames).toContain('Git Repository');
    expect(checkNames).toContain('Git Butler Config');
  });

  it('runs doctor gracefully in a non-git directory without throwing', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-butler-doctor-test-'));
    try {
      const report = await runDoctorChecks(tempDir);
      expect(report.checks.length).toBeGreaterThan(0);
      const repoCheck = report.checks.find((c) => c.name === 'Git Repository');
      expect(repoCheck?.status).toBe('warn');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
