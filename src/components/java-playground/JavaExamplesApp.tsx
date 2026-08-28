import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RunnableJavaExample from '@/components/java-playground/RunnableJavaExample';
import { looksLikeRunnableJava } from '@/lib/java-playground/exampleSource';
import { pickLiveEditors } from '@/lib/java-playground/monacoSlots';
import { preloadJavaRuntimeOnIdle } from '@/lib/java-playground/preloadJavaRuntime';

interface ExampleItem {
  id: string;
  root: HTMLElement;
  mount: HTMLElement;
  original: string;
  inExercise: boolean;
}

const originals = new Map<string, string>();

function decodeSource(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function scanExamples(): ExampleItem[] {
  const items: ExampleItem[] = [];
  const seen = new Set<string>();

  document.querySelectorAll<HTMLElement>('[data-jp-example]').forEach((root, index) => {
    if (root.dataset.jpHydrated === 'true') {
      const mount = root.querySelector<HTMLElement>('.jp-example-react');
      const id = root.dataset.jpId;
      const original = id ? originals.get(id) : undefined;
      if (mount && id && original != null) {
        seen.add(id);
        items.push({
          id,
          root,
          mount,
          original,
          inExercise: root.classList.contains('jp-example-in-exercise'),
        });
      }
      return;
    }

    const encoded = root.dataset.jpSource;
    if (!encoded) return;
    let original: string;
    try {
      original = decodeSource(encoded);
    } catch {
      return;
    }
    if (!looksLikeRunnableJava(original)) {
      const pre = root.querySelector('pre');
      if (pre) root.replaceWith(pre);
      return;
    }

    const id = `jp-ex-${index}-${Math.random().toString(36).slice(2, 8)}`;
    const inExercise = Boolean(root.closest('.exercise-box'));
    root.dataset.jpHydrated = 'true';
    root.dataset.jpId = id;
    if (inExercise) root.classList.add('jp-example-in-exercise');

    const mount = document.createElement('div');
    mount.className = 'jp-example-react';
    root.append(mount);
    originals.set(id, original);
    seen.add(id);

    items.push({ id, root, mount, original, inExercise });
  });

  for (const id of originals.keys()) {
    if (!seen.has(id)) originals.delete(id);
  }

  return items;
}

export default function JavaExamplesApp() {
  const [items, setItems] = useState<ExampleItem[]>([]);
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const prevLiveRef = useRef<string[]>([]);

  useEffect(() => {
    preloadJavaRuntimeOnIdle();
  }, []);

  useEffect(() => {
    const apply = () => setItems(scanExamples());
    apply();
    document.addEventListener('astro:page-load', apply);
    return () => document.removeEventListener('astro:page-load', apply);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setVisibility((prev) => {
          const next = { ...prev };
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.jpId;
            if (id) next[id] = entry.isIntersecting;
          }
          return next;
        });
      },
      { rootMargin: '200px' },
    );
    for (const item of items) observer.observe(item.root);
    return () => observer.disconnect();
  }, [items]);

  const handleEditingChange = useCallback((id: string, isEditing: boolean) => {
    setEditing((prev) => {
      if (prev[id] === isEditing) return prev;
      return { ...prev, [id]: isEditing };
    });
  }, []);

  useEffect(() => {
    for (const item of items) {
      const open = item.inExercise || Boolean(editing[item.id]);
      item.root.classList.toggle('jp-example-editing', open);
    }
  }, [editing, items]);

  const liveList = useMemo(() => {
    const needing = items
      .filter((item) => item.inExercise || Boolean(editing[item.id]))
      .map((item) => item.id);
    const intersecting = items.filter((item) => visibility[item.id]).map((item) => item.id);
    return pickLiveEditors(needing, intersecting, prevLiveRef.current);
  }, [editing, items, visibility]);

  useEffect(() => {
    prevLiveRef.current = liveList;
  }, [liveList]);

  const liveIds = useMemo(() => new Set(liveList), [liveList]);
  const footnoteId = items[0]?.id;

  return (
    <>
      {items.map((item) =>
        createPortal(
          <RunnableJavaExample
            key={item.id}
            id={item.id}
            original={item.original}
            inExercise={item.inExercise}
            mountEditor={liveIds.has(item.id)}
            showFootnote={item.id === footnoteId}
            onEditingChange={handleEditingChange}
          />,
          item.mount,
        ),
      )}
    </>
  );
}
