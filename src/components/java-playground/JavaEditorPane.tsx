import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSiteTheme } from '@/lib/useSiteTheme';

const CodeMirrorJavaEditor = lazy(() => import('@/components/java-playground/CodeMirrorJavaEditor'));

interface Props {
  fileName: string;
  code: string;
  onChange: (value: string) => void;
  status?: string;
  busy?: boolean;
  onRun?: () => void;
}

class EditorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function JavaEditorPane({
  fileName,
  code,
  onChange,
  status,
  busy = false,
  onRun,
}: Props) {
  const siteTheme = useSiteTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!rootRef.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '300px' });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);
  const fallback = (
    <textarea
      className="jp-editor-fallback"
      aria-label={`${fileName} source code`}
      value={code}
      onChange={(event) => onChange(event.target.value)}
      readOnly={busy}
      spellCheck={false}
    />
  );

  return (
    <div className="jp-editor" ref={rootRef} onKeyDownCapture={(event) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && onRun) {
        event.preventDefault();
        event.stopPropagation();
        if (!busy && !event.repeat) onRun();
      }
    }}>
      <div className="jp-editor-header">
        <span>{fileName}</span>
        <span className="jp-status" role="status">{status || 'Editable · Ctrl/⌘ + Enter to run'}</span>
      </div>
      <div className="jp-editor-body">
        {visible ? (
          <EditorBoundary fallback={fallback}>
            <Suspense fallback={fallback}>
              <CodeMirrorJavaEditor
                code={code}
                onChange={onChange}
                readOnly={busy}
                theme={siteTheme}
              />
            </Suspense>
          </EditorBoundary>
        ) : fallback}
      </div>
    </div>
  );
}
