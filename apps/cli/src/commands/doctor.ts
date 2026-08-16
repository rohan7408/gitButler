import pc from 'picocolors';
import { runDoctorChecks, runDoctorFix } from '@git-butler/git';

export async function runDoctorCommand(cwd: string = process.cwd(), fix: boolean = false): Promise<void> {
  console.log(pc.cyan(pc.bold('\n🔍 Running Git Butler Doctor diagnostics...\n')));

  if (fix) {
    console.log(pc.blue('🔧 Running self-healing repair routines...'));
    const { fixed } = await runDoctorFix(cwd);
    if (fixed.length > 0) {
      for (const item of fixed) {
        console.log(` ${pc.green('✓')} Repaired: ${item}`);
      }
    } else {
      console.log(' No repair actions required.');
    }
    console.log();
  }

  const report = await runDoctorChecks(cwd);

  for (const check of report.checks) {
    let icon = pc.green('✓');
    let title = pc.bold(check.name);

    if (check.status === 'warn') {
      icon = pc.yellow('⚠');
    } else if (check.status === 'fail') {
      icon = pc.red('✗');
    }

    console.log(` ${icon} ${title}: ${check.message}`);
    if (check.detail) {
      console.log(`   ${pc.dim(check.detail)}`);
    }
  }

  console.log();
  if (report.allPassed) {
    console.log(pc.green(pc.bold('✓ Environment is healthy and ready for Git Butler.')));
  } else {
    console.log(pc.red(pc.bold('✗ Some doctor checks failed. Please review the issues above.')));
  }
  console.log();
}
