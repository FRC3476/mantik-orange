import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useSiteTheme } from '@/lib/useSiteTheme';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

export const JAVA_EDITOR_OPTIONS = {
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
};

interface Props {
  fileName: string;
  code: string;
  onChange: (value: string) => void;
  status?: string;
  busy?: boolean;
  /** When false, keep the chrome but do not mount Monaco. */
  active?: boolean;
}

export default function JavaEditorPane({
  fileName,
  code,
  onChange,
  status,
  busy = false,
  active = true,
}: Props) {
  const siteTheme = useSiteTheme();
  const monacoTheme = siteTheme === 'dark' ? 'vs-dark' : 'vs';
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (active) setEditorReady(true);
  }, [active]);

  const options = useMemo(
    () => ({
      ...JAVA_EDITOR_OPTIONS,
      readOnly: busy,
    }),
    [busy],
  );

  const showEditor = active && editorReady;

  return (
    <div className="jp-editor">
      <div className="jp-editor-header">
        <span>{fileName}</span>
        <span className="jp-status">{status || 'Editable'}</span>
      </div>
      <div className="jp-editor-body">
        {showEditor ? (
          <Suspense fallback={<p className="jp-editor-loading">Loading editor…</p>}>
            <MonacoEditor
              height="100%"
              defaultLanguage="java"
              theme={monacoTheme}
              value={code}
              onChange={(value) => onChange(value ?? '')}
              onMount={(editor, monaco) => {
                editor.layout();
                editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {});
              }}
              options={options}
            />
          </Suspense>
        ) : (
          <p className="jp-editor-loading">Loading editor…</p>
        )}
      </div>
    </div>
  );
}
