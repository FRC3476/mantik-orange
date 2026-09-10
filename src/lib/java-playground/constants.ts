export const CHEERPJ_LOADER = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
export const CHEERPJ_ORIGIN = 'https://cjrtnc.leaningtech.com';
export const ECJ_MAIN = 'org.eclipse.jdt.internal.compiler.batch.Main';
export const ECJ_FILENAME = 'ecj-3.16.0.jar';
export const LAUNCHER_CLASS = 'JpStdioLauncher';
export const WARMUP_CLASS = 'JpWarmup';

export const STDIN_PATH = '/str/jp-stdin.txt';
export const STDOUT_PATH = '/files/jp-stdout.txt';
export const STDERR_PATH = '/files/jp-stderr.txt';
export const EXIT_PATH = '/files/jp-exit.txt';
export const CLASS_DIR = '/files/jp-classes';

/** Kill an in-flight student run after this many ms in the Running/Checking phase. */
export const RUN_TIMEOUT_MS = 20_000;
/** Safety cap for CheerpJ init + first compile (downloads can be slow). */
export const INIT_TIMEOUT_MS = 180_000;

export function timeoutMessage(ms: number): string {
  return `Program stopped after ${Math.round(ms / 1000)} s`;
}

export class JavaRunCancelledError extends Error {
  constructor(message = 'Stopped.') {
    super(message);
    this.name = 'JavaRunCancelledError';
  }
}
