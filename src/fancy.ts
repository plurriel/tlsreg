import { ChalkInstance } from 'chalk';

let chalk: ChalkInstance | undefined;
try {
  chalk = await import('chalk').then((v) => v.default);
} catch(err) {
  // Ignore
}

export const fancy = {
  up: (a: any) => chalk ? `${chalk.bold.green('[  UP  ]')} ${chalk.bold(a)} ${chalk.italic('is up and running!')}` : `[  UP  ] ${a} is up and running!`,
};
