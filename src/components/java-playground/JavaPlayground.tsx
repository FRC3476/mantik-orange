import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSiteTheme } from '@/lib/useSiteTheme';
import { getExercise } from '@/lib/java-playground/exercises';
import { compileAndRun } from '@/lib/java-playground/cheerpjRunner';
import { runHiddenTests } from '@/lib/java-playground/runChecks';
import type { CheckResult } from '@/lib/java-playground/types';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface Props {
  id: string;
}

type Phase = 'idle' | 'working';

export default function JavaPlayground({ id }: Props) {
  const exercise = getExercise(id);
  const siteTheme = useSiteTheme();
  const monacoTheme = siteTheme === 'dark' ? 'vs-dark' : 'vs';

  const [code, setCode] = useState(exercise?.starter ?? '');
  const [stdin, setStdin] = useState('');
  const [status, setStatus] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [consoleText, setConsoleText] = useState('');
  const [consoleKind, setConsoleKind] = useState<'empty' | 'out' | 'error'>('empty');
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    setEditorReady(true);
  }, []);

  const busy = phase === 'working';

  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, monospace',
      scrollBeyondLastLine: false,
      wordWrap: 'on' as const,
      padding: { top: 12 },
      lineNumbers: 'on' as const,
      tabSize: 4,
      automaticLayout: true,
      renderLineHighlight: 'line' as const,
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off' as const,
      parameterHints: { enabled: false },
      snippetSuggestions: 'none' as const,
      hover: { enabled: false },
    }),
    [],
  );

  const handleRun = useCallback(async () => {
    if (!exercise || busy) return;
    setPhase('working');
    setCheck(null);
    setStatus('Starting…');
    try {
      const result = await compileAndRun(code, exercise.showStdin ? stdin : '', setStatus);
      if (result.compileFailed) {
        setConsoleKind('error');
        setConsoleText(result.compileOutput || 'Compilation failed.');
      } else {
        const parts = [result.stdout, result.stderr.trim() ? result.stderr : '']
          .filter((part) => part.length > 0)
          .join(result.stdout && result.stderr.trim() ? '\n' : '');
        setConsoleKind(result.stderr.trim() ? 'error' : 'out');
        setConsoleText(parts.length > 0 ? parts : '(no output)');
      }
    } catch (err) {
      setConsoleKind('error');
      setConsoleText(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase('idle');
      setStatus('');
    }
  }, [busy, code, exercise, stdin]);

  const handleCheck = useCallback(async () => {
    if (!exercise || busy) return;
    setPhase('working');
    setCheck(null);
    setStatus('Checking…');
    try {
      const result = await runHiddenTests(code, exercise.tests, setStatus);
      setCheck(result);
      const failed = result.cases.find((c) => !c.passed);
      if (!failed) {
        setConsoleKind('out');
        setConsoleText(result.cases.map((c) => c.actual).join('\n---\n') || '(no output)');
      } else if (failed.compileFailed) {
        setConsoleKind('error');
        setConsoleText(failed.actual);
      } else {
        setConsoleKind('error');
        setConsoleText(failed.stderr.trim() ? failed.stderr : failed.actual || '(no output)');
      }
    } catch (err) {
      setConsoleKind('error');
      setConsoleText(err instanceof Error ? err.message : String(err));
    } finally {
      setPhase('idle');
      setStatus('');
    }
  }, [busy, code, exercise]);

  const handleReset = useCallback(() => {
    if (!exercise || busy) return;
    setCode(exercise.starter);
    setStdin('');
    setConsoleText('');
    setConsoleKind('empty');
    setCheck(null);
    setStatus('');
  }, [busy, exercise]);

  if (!exercise) {
    return (
      <div className="jp-playground">
        <p className="jp-error">Unknown playground id: {id}</p>
      </div>
    );
  }

  return (
    <section className="jp-playground" aria-label={exercise.title}>
      <h3>{exercise.title}</h3>
      <p className="jp-prompt">{exercise.prompt}</p>

      <div className="jp-editor">
        <div className="jp-editor-header">
          <span>Main.java</span>
          {status ? <span className="jp-status">{status}</span> : <span className="jp-status">Editable</span>}
        </div>
        <div className="jp-editor-body">
          {editorReady ? (
            <Suspense fallback={<p className="jp-editor-loading">Loading editor…</p>}>
              <MonacoEditor
                height="280px"
                defaultLanguage="java"
                theme={monacoTheme}
                value={code}
                onChange={(value) => setCode(value ?? '')}
                onMount={(editor, monaco) => {
                  editor.layout();
                  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {});
                }}
                options={editorOptions}
              />
            </Suspense>
          ) : (
            <p className="jp-editor-loading">Loading editor…</p>
          )}
        </div>
      </div>

      {exercise.showStdin && (
        <label className="jp-stdin">
          <span>Program input (Run only)</span>
          <textarea
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            placeholder="Optional. Sent to System.in when you click Run. Check ignores this box."
            rows={4}
            disabled={busy}
            spellCheck={false}
          />
        </label>
      )}

      <div className="jp-actions">
        <button type="button" className="jp-btn jp-btn-run" onClick={handleRun} disabled={busy}>
          Run
        </button>
        <button type="button" className="jp-btn jp-btn-check" onClick={handleCheck} disabled={busy}>
          Check
        </button>
        <button type="button" className="jp-btn jp-btn-reset" onClick={handleReset} disabled={busy}>
          Reset
        </button>
      </div>

      <div
        className={`jp-console jp-console-${consoleKind}`}
        aria-live="polite"
        aria-label="Program output"
      >
        <div className="jp-console-header">Console</div>
        <pre>{consoleText || 'Output appears here after Run or Check.'}</pre>
      </div>

      {check && (
        <ul className="jp-results">
          {check.cases.map((testCase) => (
            <li key={testCase.name} className={testCase.passed ? 'jp-pass' : 'jp-fail'}>
              <strong>{testCase.passed ? 'Passed' : 'Not yet'}:</strong> {testCase.name}
              {!testCase.passed && (
                <div className="jp-diff">
                  <div>
                    <span>Expected</span>
                    <pre>{testCase.expected}</pre>
                  </div>
                  <div>
                    <span>Your output</span>
                    <pre>{testCase.stderr.trim() ? testCase.stderr : testCase.actual}</pre>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="jp-footnote">
        Java compiles and runs in your browser using CheerpJ. The first Run downloads the runtime and can
        take a while. If the page stops responding, reload it.
      </p>
    </section>
  );
}
