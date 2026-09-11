import { wrapExampleSource } from './exampleSource';
import {
  INIT_TIMEOUT_MS,
  JavaRunCancelledError,
  RUN_TIMEOUT_MS,
  timeoutMessage,
} from './constants';
import type { WorkerReply, WorkerRequest } from './protocol';
import { isRunPhaseStatus } from './protocol';
import { assertPublicMain } from './sourceChecks';
import { logJpTimings } from './timing';
import type { RunResult, StatusFn } from './types';

const ENTRY_CLASS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onStatus?: StatusFn;
  safetyTimer?: ReturnType<typeof setTimeout>;
  runTimer?: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
let generation = 0;
let preloadPromise: Promise<void> | null = null;
let startupStatus = '';
const startupListeners = new Set<StatusFn>();

function reportStartup(message: string): void {
  startupStatus = message;
  for (const listener of startupListeners) listener(message);
}
let runChain: Promise<unknown> = Promise.resolve();
const pending = new Map<number, Pending>();

function compileFail(message: string): RunResult {
  return {
    ok: false,
    compileFailed: true,
    compileOutput: message,
    stdout: '',
    stderr: '',
    exitCode: 1,
  };
}

function clearTimers(item: Pending): void {
  if (item.safetyTimer) clearTimeout(item.safetyTimer);
  if (item.runTimer) clearTimeout(item.runTimer);
}

function spawnWorker(): Worker {
  const created = new Worker(new URL('./worker/javaRunner.worker.ts', import.meta.url), {
    type: 'classic',
    name: 'java-runner',
  });
  created.onmessage = (event: MessageEvent<WorkerReply>) => {
    const data = event.data;
    if (!data || typeof data.id !== 'number') return;
    const item = pending.get(data.id);
    if (!item) return;
    if (data.type === 'status') {
      item.onStatus?.(data.message);
      if (item.runTimer) {
        clearTimeout(item.runTimer);
        item.runTimer = undefined;
      }
      if (isRunPhaseStatus(data.message)) {
        item.runTimer = setTimeout(() => {
          cancel(timeoutMessage(RUN_TIMEOUT_MS));
        }, RUN_TIMEOUT_MS);
      }
      return;
    }
    pending.delete(data.id);
    clearTimers(item);
    if (data.type === 'error') {
      item.reject(new Error(data.message));
      return;
    }
    logJpTimings(data.timings);
    item.resolve(data.result);
  };
  created.onerror = (event) => {
    workerFailed = true;
    const error = new Error(event.message || 'The Java runtime worker failed.');
    rejectAll(error);
    worker?.terminate();
    worker = null;
  };
  return created;
}

function getWorker(): Worker {
  if (workerFailed) {
    throw new Error('The Java runtime worker is not available.');
  }
  if (!worker) {
    try {
      worker = spawnWorker();
    } catch (err) {
      workerFailed = true;
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
  return worker;
}

function rejectAll(error: Error): void {
  for (const item of pending.values()) {
    clearTimers(item);
    item.reject(error);
  }
  pending.clear();
}

type RequestPayload<T = WorkerRequest> = T extends WorkerRequest ? Omit<T, 'id'> : never;

function request<T>(
  payload: RequestPayload,
  onStatus?: StatusFn,
  safetyMs = INIT_TIMEOUT_MS,
): Promise<T> {
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    let w: Worker;
    try {
      w = getWorker();
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const item: Pending = {
      resolve: (value) => resolve(value as T),
      reject,
      onStatus,
    };
    item.safetyTimer = setTimeout(() => {
      if (pending.has(id)) {
        cancel(timeoutMessage(safetyMs));
      }
    }, safetyMs);
    pending.set(id, item);
    w.postMessage({ id, ...payload } satisfies WorkerRequest);
  });
}

function enqueue<T>(fn: () => Promise<T>, onStatus?: StatusFn): Promise<T> {
  const queuedGeneration = generation;
  onStatus?.(startupStatus || 'Waiting for Java…');
  if (onStatus) startupListeners.add(onStatus);
  const start = () => {
    if (onStatus) startupListeners.delete(onStatus);
    if (queuedGeneration !== generation) throw new JavaRunCancelledError();
    return fn();
  };
  const run = runChain.then(start, start);
  runChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function fallbackCompileRun(options: {
  source: string;
  entryClass: string;
  stdin: string;
  runMain: boolean;
  onStatus?: StatusFn;
}): Promise<RunResult> {
  const runtime = await import('./cheerpjRuntime');
  return runtime.compileThenRun(options);
}

async function fallbackCompileCases(options: {
  source: string;
  entryClass: string;
  stdins: string[];
  onStatus?: StatusFn;
}): Promise<RunResult[]> {
  const runtime = await import('./cheerpjRuntime');
  return runtime.compileThenRunCases(options);
}

async function compileThenRunOnBackend(options: {
  source: string;
  entryClass: string;
  stdin: string;
  runMain: boolean;
  onStatus?: StatusFn;
}): Promise<RunResult> {
  if (workerFailed) {
    return fallbackCompileRun(options);
  }
  try {
    return await request<RunResult>(
      {
        type: 'compile-run',
        source: options.source,
        entryClass: options.entryClass,
        stdin: options.stdin,
        runMain: options.runMain,
      },
      options.onStatus,
    );
  } catch (err) {
    if (err instanceof JavaRunCancelledError) throw err;
    if (workerFailed) return fallbackCompileRun(options);
    throw err;
  }
}

/** Start CheerpJ without compiling student code. Safe to call from page load. */
export function preloadJavaRuntime(onStatus?: StatusFn): Promise<void> {
  if (onStatus) startupListeners.add(onStatus);
  if (startupStatus) onStatus?.(startupStatus);
  if (!preloadPromise) {
    const startedGeneration = generation;
    reportStartup('Loading Java runtime…');
    preloadPromise = enqueue(async () => {
      if (workerFailed) {
        const runtime = await import('./cheerpjRuntime');
        await runtime.ensureRuntime(reportStartup);
        return;
      }
      try {
        await request<null>({ type: 'init' }, reportStartup, INIT_TIMEOUT_MS);
      } catch (err) {
        if (err instanceof JavaRunCancelledError) throw err;
        workerFailed = true;
        worker?.terminate();
        worker = null;
        const runtime = await import('./cheerpjRuntime');
        await runtime.ensureRuntime(reportStartup);
      }
    }).finally(() => {
      if (startedGeneration === generation) {
        startupStatus = '';
        preloadPromise = null;
      }
    });
  }
  return preloadPromise.finally(() => {
    if (onStatus) startupListeners.delete(onStatus);
  });
}

export function cancel(message = 'Stopped.'): void {
  generation += 1;
  preloadPromise = null;
  startupStatus = '';
  startupListeners.clear();
  const error = new JavaRunCancelledError(message);
  rejectAll(error);
  if (worker) {
    worker.terminate();
    worker = null;
  }
  runChain = Promise.resolve();
  if (!workerFailed) {
    void preloadJavaRuntime().catch(() => { /* A later Run can retry startup. */ });
  }
}

export async function compileAndRun(
  source: string,
  stdin = '',
  onStatus?: StatusFn,
): Promise<RunResult> {
  const classError = assertPublicMain(source);
  if (classError) return compileFail(classError);
  return enqueue(() =>
    compileThenRunOnBackend({
      source,
      entryClass: 'Main',
      stdin,
      onStatus,
      runMain: true,
    }),
    onStatus,
  );
}

/** Lesson examples: wrap snippets, allow any public class name, skip run when there is no main. */
export async function compileAndRunExample(
  source: string,
  stdin = '',
  onStatus?: StatusFn,
): Promise<RunResult> {
  const prepared = wrapExampleSource(source);
  if (!ENTRY_CLASS_RE.test(prepared.entryClass)) {
    return compileFail('This example does not have a valid class name to compile.');
  }
  return enqueue(() =>
    compileThenRunOnBackend({
      source: prepared.source,
      entryClass: prepared.entryClass,
      stdin,
      onStatus,
      runMain: prepared.hasMain,
    }),
    onStatus,
  );
}

/** Compile once, then run the same classes with each stdin. Used by Check. */
export async function compileAndRunCases(
  source: string,
  stdins: string[],
  onStatus?: StatusFn,
): Promise<RunResult[]> {
  const classError = assertPublicMain(source);
  if (classError) return stdins.map(() => compileFail(classError));
  return enqueue(async () => {
    if (workerFailed) {
      return fallbackCompileCases({ source, entryClass: 'Main', stdins, onStatus });
    }
    try {
      return await request<RunResult[]>(
        { type: 'compile-run-cases', source, entryClass: 'Main', stdins },
        onStatus,
      );
    } catch (err) {
      if (err instanceof JavaRunCancelledError) throw err;
      if (workerFailed) {
        return fallbackCompileCases({ source, entryClass: 'Main', stdins, onStatus });
      }
      throw err;
    }
  }, onStatus);
}

export async function dumpCheerpjResources(): Promise<string | null> {
  if (workerFailed) {
    const runtime = await import('./cheerpjRuntime');
    await runtime.ensureRuntime();
    return runtime.getRuntimeResourcesJson();
  }
  try {
    const result = await request<string | null>({ type: 'dump-resources' });
    return result;
  } catch {
    const runtime = await import('./cheerpjRuntime');
    return runtime.getRuntimeResourcesJson();
  }
}
