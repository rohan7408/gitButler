import pc from 'picocolors';

export const VERSION = '0.1.2';

export function runVersionCommand(): void {
  console.log(`${pc.bold('Git Butler')} v${VERSION}`);
}
