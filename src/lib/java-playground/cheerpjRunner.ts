import { wrapExampleSource } from './exampleSource';
import { assertPublicMain } from './sourceChecks';
import type { RunResult, StatusFn } from './types';

const CHEERPJ_LOADER = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
const ECJ_MAIN = 'org.eclipse.jdt.internal.compiler.batch.Main';
const LAUNCHER_CLASS = 'JpStdioLauncher';
const LAUNCHER_PATH = `/str/${LAUNCHER_CLASS}.java`;
const STDIN_PATH = '/str/jp-stdin.txt';
const STDOUT_PATH = '/files/jp-stdout.txt';
const STDERR_PATH = '/files/jp-stderr.txt';
const CLASS_DIR = '/files/jp-classes';
const ENTRY_CLASS_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const LAUNCHER_SOURCE = `import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.PrintStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public class JpStdioLauncher {
    public static void main(String[] args) throws Exception {
        String stdinPath = args.length > 0 ? args[0] : "${STDIN_PATH}";
        String stdoutPath = args.length > 1 ? args[1] : "${STDOUT_PATH}";
        String stderrPath = args.length > 2 ? args[2] : "${STDERR_PATH}";
        String entryClass = args.length > 3 ? args[3] : "Main";

        File stdinFile = new File(stdinPath);
        InputStream in;
        if (stdinFile.exists() && stdinFile.length() > 0) {
            in = new FileInputStream(stdinFile);
        } else {
            in = new ByteArrayInputStream(new byte[0]);
        }
        System.setIn(in);

        PrintStream out = new PrintStream(new FileOutputStream(stdoutPath), true, "UTF-8");
        PrintStream err = new PrintStream(new FileOutputStream(stderrPath), true, "UTF-8");
        System.setOut(out);
        System.setErr(err);

        try {
            Method main = Class.forName(entryClass).getMethod("main", String[].class);
            main.invoke(null, (Object) new String[0]);
        } catch (NoSuchMethodException e) {
            err.println("This example compiled, but it has no main method to run.");
        } catch (InvocationTargetException e) {
            Throwable cause = e.getCause() != null ? e.getCause() : e;
            cause.printStackTrace(err);
        } catch (Throwable t) {
            t.printStackTrace(err);
        } finally {
            out.flush();
            err.flush();
            out.close();
            err.close();
            try { in.close(); } catch (Exception ignored) {}
        }
    }
}
`;

interface CheerpJGlobals {
  cheerpjInit?: (options?: Record<string, unknown>) => Promise<void>;
  cheerpjRunMain?: (className: string, classPath: string, ...args: string[]) => Promise<number>;
  cheerpOSAddStringFile?: (path: string, content: string) => void;
  cheerpjAddStringFile?: (path: string, content: string) => void;
  cheerpOSRemoveStringFile?: (path: string) => void;
  cjFileBlob?: (path: string) => Promise<Blob> | Blob;
}

let initPromise: Promise<void> | null = null;
let runChain: Promise<unknown> = Promise.resolve();

function globals(): CheerpJGlobals {
  return globalThis as unknown as CheerpJGlobals;
}

/** CheerpJ `/app/` maps to the origin root, so include Astro's base path. */
function ecjClasspath(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL.slice(0, -1)
    : import.meta.env.BASE_URL;
  return `/app${base}/java-playground/ecj.jar`;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
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

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = runChain.then(fn, fn);
  runChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureInit(onStatus?: StatusFn): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      onStatus?.('Loading Java runtime…');
      await loadScript(CHEERPJ_LOADER);
      const g = globals();
      if (typeof g.cheerpjInit !== 'function') {
        throw new Error('CheerpJ loaded, but cheerpjInit is missing.');
      }
      await g.cheerpjInit({
        version: 8,
        status: 'none',
        preloadProgress: (done: number, total: number) => {
          if (total > 0) {
            onStatus?.(`Loading Java runtime… ${Math.round((done / total) * 100)}%`);
          }
        },
      });
    })();
  }
  try {
    await initPromise;
  } catch (err) {
    initPromise = null;
    throw err;
  }
}

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

export async function compileAndRun(
  source: string,
  stdin = '',
  onStatus?: StatusFn,
): Promise<RunResult> {
  const classError = assertPublicMain(source);
  if (classError) return compileFail(classError);
  return enqueue(() =>
    compileRunFiles({
      source,
      entryClass: 'Main',
      stdin,
      onStatus,
      runMain: true,
    }),
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
    compileRunFiles({
      source: prepared.source,
      entryClass: prepared.entryClass,
      stdin,
      onStatus,
      runMain: prepared.hasMain,
    }),
  );
}

interface CompileRunFiles {
  source: string;
  entryClass: string;
  stdin: string;
  onStatus?: StatusFn;
  runMain: boolean;
}

async function compileRunFiles({
  source,
  entryClass,
  stdin,
  onStatus,
  runMain,
}: CompileRunFiles): Promise<RunResult> {
  await ensureInit(onStatus);

  const g = globals();
  if (typeof g.cheerpjRunMain !== 'function') {
    throw new Error('CheerpJ loaded, but cheerpjRunMain is missing.');
  }

  const sourcePath = `/str/${entryClass}.java`;
  addStringFile(sourcePath, source.replace(/\r\n/g, '\n'));
  addStringFile(LAUNCHER_PATH, LAUNCHER_SOURCE);
  addStringFile(STDIN_PATH, stdin.replace(/\r\n/g, '\n'));

  onStatus?.('Compiling…');
  const compileCapture = await captureConsole(() =>
    g.cheerpjRunMain!(
      ECJ_MAIN,
      ecjClasspath(),
      '-d',
      CLASS_DIR,
      '-1.8',
      '-nowarn',
      '-bootclasspath',
      '/lt/8/jre/lib/rt.jar',
      sourcePath,
      LAUNCHER_PATH,
    ),
  );

  const compileOutput = filterRuntimeLog(compileCapture.log);

  if (compileCapture.result !== 0) {
    return {
      ok: false,
      compileFailed: true,
      compileOutput: compileOutput || 'Compilation failed.',
      stdout: '',
      stderr: '',
      exitCode: compileCapture.result,
    };
  }

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

  onStatus?.('Running…');
  const runCapture = await captureConsole(() =>
    g.cheerpjRunMain!(LAUNCHER_CLASS, CLASS_DIR, STDIN_PATH, STDOUT_PATH, STDERR_PATH, entryClass),
  );

  let stdout = await readVfsText(STDOUT_PATH);
  let stderr = await readVfsText(STDERR_PATH);
  if (!stdout && !stderr) {
    const direct = await captureConsole(() => g.cheerpjRunMain!(entryClass, CLASS_DIR));
    stdout = filterRuntimeLog(direct.log);
    return {
      ok: direct.result === 0,
      compileFailed: false,
      compileOutput: '',
      stdout,
      stderr: '',
      exitCode: direct.result,
    };
  }

  if (!stdout && runCapture.log) {
    stdout = filterRuntimeLog(runCapture.log);
  }

  return {
    ok: runCapture.result === 0 && !stderr.trim(),
    compileFailed: false,
    compileOutput: '',
    stdout,
    stderr,
    exitCode: runCapture.result,
  };
}
