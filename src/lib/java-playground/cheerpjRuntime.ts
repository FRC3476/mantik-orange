import preloadResources from './cheerpjPreload.json';
import { ecjClasspath, launcherClasspath } from './assets';
import {
  CHEERPJ_LOADER,
  CLASS_DIR,
  ECJ_MAIN,
  EXIT_PATH,
  LAUNCHER_CLASS,
  STDERR_PATH,
  STDIN_PATH,
  STDOUT_PATH,
  WARMUP_CLASS,
} from './constants';
import type { JpTimings } from './timing';
import { nowMs } from './timing';
import type { RunResult, StatusFn } from './types';

const WARMUP_SOURCE = `import java.util.ArrayList;
import java.util.Locale;
import java.util.Scanner;

public class JpWarmup {
    public static void main(String[] args) {
        ArrayList<Integer> nums = new ArrayList<Integer>();
        nums.add(3);
        Scanner sc = new Scanner("7");
        int n = sc.nextInt();
        String msg = String.format(Locale.US, "%d %.2f", nums.get(0) + n, Math.sqrt(4.0));
        System.out.println(msg);
        sc.close();
    }
}
`;

interface CheerpJGlobals {
  cheerpjInit?: (options?: Record<string, unknown>) => Promise<void>;
  cheerpjRunMain?: (className: string, classPath: string, ...args: string[]) => Promise<number>;
  cheerpOSAddStringFile?: (path: string, content: string) => void;
  cheerpjAddStringFile?: (path: string, content: string) => void;
  cjFileBlob?: (path: string) => Promise<Blob> | Blob;
  cjGetRuntimeResources?: () => string;
}

let initPromise: Promise<void> | null = null;
let cheerpjReady = false;
let launcherReady = false;
let warmupDone = false;
let compiledKey: string | null = null;
let lastStdin: string | null = null;
let initStatus: StatusFn | undefined;
const lastTimings: JpTimings = {};

function globals(): CheerpJGlobals {
  return globalThis as unknown as CheerpJGlobals;
}

function canImportScripts(): boolean {
  return typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === 'function';
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Cannot load the Java runtime outside a browser document.'));
      return;
    }
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the Java runtime from the CheerpJ CDN.'));
    document.head.appendChild(script);
  });
}

async function loadCheerpjLoader(): Promise<void> {
  if (typeof globals().cheerpjInit === 'function') return;
  if (canImportScripts()) {
    (globalThis as unknown as { importScripts: (...urls: string[]) => void }).importScripts(CHEERPJ_LOADER);
    return;
  }
  await loadScript(CHEERPJ_LOADER);
}

function addStringFile(path: string, content: string): void {
  const g = globals();
  if (typeof g.cheerpOSAddStringFile === 'function') {
    g.cheerpOSAddStringFile(path, content);
    return;
  }
  if (typeof g.cheerpjAddStringFile === 'function') {
    g.cheerpjAddStringFile(path, content);
    return;
  }
  throw new Error('CheerpJ filesystem is not available.');
}

async function readVfsText(path: string): Promise<string> {
  const g = globals();
  if (typeof g.cjFileBlob !== 'function') return '';
  try {
    const blob = await g.cjFileBlob(path);
    return await blob.text();
  } catch {
    return '';
  }
}

async function captureConsole<T>(fn: () => Promise<T>): Promise<{ result: T; log: string }> {
  const lines: string[] = [];
  const orig = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };
  const push = (...args: unknown[]) => {
    lines.push(args.map((arg) => (typeof arg === 'string' ? arg : String(arg))).join(' '));
  };
  console.log = (...args: unknown[]) => {
    push(...args);
    orig.log.apply(console, args);
  };
  console.warn = (...args: unknown[]) => {
    push(...args);
    orig.warn.apply(console, args);
  };
  console.error = (...args: unknown[]) => {
    push(...args);
    orig.error.apply(console, args);
  };
  console.info = (...args: unknown[]) => {
    push(...args);
    orig.info.apply(console, args);
  };
  try {
    const result = await fn();
    return { result, log: lines.join('\n') };
  } finally {
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
    console.info = orig.info;
  }
}

function filterRuntimeLog(log: string): string {
  return log
    .split('\n')
    .filter((line) => !/cheerpj|cjrtnc|leaningtech|Downloading runtime/i.test(line))
    .join('\n')
    .trim();
}

function cacheKey(entryClass: string, source: string): string {
  return `${entryClass}\n${source.replace(/\r\n/g, '\n')}`;
}

function preloadOption(): Record<string, number[]> | undefined {
  if (!preloadResources || typeof preloadResources !== 'object') return undefined;
  if (Object.keys(preloadResources as object).length === 0) return undefined;
  return preloadResources as Record<string, number[]>;
}

function ecjArgs(sourcePath: string): string[] {
  return [
    '-d',
    CLASS_DIR,
    '-1.8',
    '-nowarn',
    '-g',
    '-proc:none',
    '-bootclasspath',
    '/lt/8/jre/lib/rt.jar',
    sourcePath,
  ];
}

async function compileEcj(sourcePath: string): Promise<{ code: number; log: string }> {
  const g = globals();
  if (typeof g.cheerpjRunMain !== 'function') {
    throw new Error('CheerpJ loaded, but cheerpjRunMain is missing.');
  }
  const capture = await captureConsole(() =>
    g.cheerpjRunMain!(ECJ_MAIN, ecjClasspath(), ...ecjArgs(sourcePath)),
  );
  return { code: capture.result, log: filterRuntimeLog(capture.log) };
}

function writeStdin(stdin: string): void {
  const normalized = stdin.replace(/\r\n/g, '\n');
  if (lastStdin === normalized) return;
  addStringFile(STDIN_PATH, normalized);
  lastStdin = normalized;
}

async function compileIfNeeded(
  source: string,
  entryClass: string,
  onStatus?: StatusFn,
): Promise<RunResult | null> {
  const normalized = source.replace(/\r\n/g, '\n');
  const key = cacheKey(entryClass, normalized);
  if (compiledKey === key) {
    return null;
  }

  const sourcePath = `/str/${entryClass}.java`;
  addStringFile(sourcePath, normalized);

  onStatus?.('Compiling…');
  const started = nowMs();
  const compile = await compileEcj(sourcePath);
  lastTimings.compile = nowMs() - started;

  if (compile.code !== 0) {
    compiledKey = null;
    return {
      ok: false,
      compileFailed: true,
      compileOutput: compile.log || 'Compilation failed.',
      stdout: '',
      stderr: '',
      exitCode: compile.code,
    };
  }

  compiledKey = key;
  return null;
}

async function runEntry(
  entryClass: string,
  stdin: string,
  onStatus?: StatusFn,
  runMain = true,
): Promise<RunResult> {
  const g = globals();
  if (typeof g.cheerpjRunMain !== 'function') {
    throw new Error('CheerpJ loaded, but cheerpjRunMain is missing.');
  }

  writeStdin(stdin);

  if (!runMain) {
    return {
      ok: true,
      compileFailed: false,
      compileOutput: '',
      stdout: '',
      stderr: '',
      exitCode: 0,
      noMain: true,
    };
  }

  const exitToken = `done-${Date.now()}`;
  onStatus?.('Running…');
  const started = nowMs();
  const runCapture = await captureConsole(() =>
    g.cheerpjRunMain!(
      LAUNCHER_CLASS,
      `${launcherClasspath()}:${CLASS_DIR}`,
      STDIN_PATH,
      STDOUT_PATH,
      STDERR_PATH,
      EXIT_PATH,
      entryClass,
      exitToken,
    ),
  );
  lastTimings.run = nowMs() - started;

  const stdout = await readVfsText(STDOUT_PATH);
  const stderr = await readVfsText(STDERR_PATH);
  const exitText = await readVfsText(EXIT_PATH);
  const exitLines = exitText.split('\n').map((line) => line.trim());
  const finished = exitLines[0] === exitToken;
  const markedCode = Number(exitLines[1]);
  const exitCode = Number.isFinite(markedCode) ? markedCode : runCapture.result;

  if (!finished) {
    return {
      ok: false,
      compileFailed: false,
      compileOutput: '',
      stdout: stdout || filterRuntimeLog(runCapture.log),
      stderr: stderr || 'The program did not finish.',
      exitCode: exitCode || 1,
    };
  }

  return {
    ok: exitCode === 0 && !stderr.trim(),
    compileFailed: false,
    compileOutput: '',
    stdout,
    stderr,
    exitCode,
  };
}

async function ensureLauncherReady(): Promise<void> {
  if (launcherReady) return;
  const started = nowMs();
  initStatus?.('Preparing runtime…');
  // Prebuilt jar — touching the classpath once lets CheerpJ fetch it in parallel with warmup.
  launcherReady = true;
  lastTimings.launcher = nowMs() - started;
}

async function runWarmup(): Promise<void> {
  if (warmupDone) return;
  const started = nowMs();
  initStatus?.('Warming up compiler…');
  const failed = await compileIfNeeded(WARMUP_SOURCE, WARMUP_CLASS, initStatus);
  if (!failed) {
    await runEntry(WARMUP_CLASS, '', undefined, true);
  }
  warmupDone = true;
  lastTimings.warmup = nowMs() - started;
}

export async function ensureRuntime(onStatus?: StatusFn): Promise<void> {
  if (onStatus) initStatus = onStatus;
  if (!initPromise) {
    initPromise = (async () => {
      if (!cheerpjReady) {
        initStatus?.('Loading Java runtime…');
        const loaderStarted = nowMs();
        await loadCheerpjLoader();
        lastTimings.loader = nowMs() - loaderStarted;
        const g = globals();
        if (typeof g.cheerpjInit !== 'function') {
          throw new Error('CheerpJ loaded, but cheerpjInit is missing.');
        }
        const initStarted = nowMs();
        const preload = preloadOption();
        await g.cheerpjInit({
          version: 8,
          status: 'none',
          ...(preload ? { preloadResources: preload } : {}),
          preloadProgress: (done: number, total: number) => {
            if (total > 0) {
              initStatus?.(`Loading Java runtime… ${Math.round((done / total) * 100)}%`);
            }
          },
        });
        lastTimings.init = nowMs() - initStarted;
        cheerpjReady = true;
      }
      await ensureLauncherReady();
      await runWarmup();
    })();
  }
  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

export function takeTimings(): JpTimings {
  return { ...lastTimings };
}

export function getRuntimeResourcesJson(): string | null {
  const fn = globals().cjGetRuntimeResources;
  if (typeof fn !== 'function') return null;
  try {
    return fn();
  } catch {
    return null;
  }
}

export async function compileThenRun(options: {
  source: string;
  entryClass: string;
  stdin: string;
  onStatus?: StatusFn;
  runMain: boolean;
}): Promise<RunResult> {
  await ensureRuntime(options.onStatus);
  const failed = await compileIfNeeded(options.source, options.entryClass, options.onStatus);
  if (failed) return failed;
  return runEntry(options.entryClass, options.stdin, options.onStatus, options.runMain);
}

export async function compileThenRunCases(options: {
  source: string;
  entryClass: string;
  stdins: string[];
  onStatus?: StatusFn;
}): Promise<RunResult[]> {
  await ensureRuntime(options.onStatus);
  const failed = await compileIfNeeded(options.source, options.entryClass, options.onStatus);
  if (failed) return options.stdins.map(() => failed);
  const results: RunResult[] = [];
  for (let i = 0; i < options.stdins.length; i++) {
    options.onStatus?.(options.stdins.length > 1 ? `Checking ${i + 1} of ${options.stdins.length}…` : 'Checking…');
    results.push(await runEntry(options.entryClass, options.stdins[i] ?? '', options.onStatus, true));
  }
  return results;
}
