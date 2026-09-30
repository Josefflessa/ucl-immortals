import { spawn } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const spawnOptions = { stdio: 'inherit', env: process.env };
const run = args => process.platform === 'win32'
  ? spawn('cmd.exe', ['/d', '/s', '/c', [pnpm, ...args].join(' ')], spawnOptions)
  : spawn(pnpm, args, spawnOptions);
const processes = [
  run(['dev']),
  run(['run', 'dev:worker']),
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 250);
}

for (const child of processes) {
  child.on('error', error => {
    console.error(`[dev] não foi possível iniciar um processo: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown && (code ?? 0) !== 0) {
      console.error(`[dev] um processo terminou${signal ? ` por ${signal}` : ` com código ${code}`}.`);
      stopAll(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
