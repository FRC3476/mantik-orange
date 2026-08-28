import { compileAndRunExample } from './cheerpjRunner';
import { exampleNeedsStdin, looksLikeRunnableJava } from './exampleSource';

const NO_MAIN_MESSAGE =
  'This example compiled. It has no main method, so nothing printed. Click Edit to add main and try it.';

function decodeSource(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function setBusy(root: HTMLElement, busy: boolean) {
  root.querySelectorAll('button, textarea').forEach((el) => {
    if (el instanceof HTMLButtonElement || el instanceof HTMLTextAreaElement) {
      el.disabled = busy;
    }
  });
}

function mountExample(root: HTMLElement) {
  if (root.dataset.jpHydrated === 'true') return;
  const encoded = root.dataset.jpSource;
  if (!encoded) return;
  let original: string;
  try {
    original = decodeSource(encoded);
  } catch {
    return;
  }
  if (!looksLikeRunnableJava(original)) return;

  root.dataset.jpHydrated = 'true';

  const tools = document.createElement('div');
  tools.className = 'jp-example-tools';

  const edit = document.createElement('textarea');
  edit.className = 'jp-example-edit';
  edit.value = original;
  edit.spellcheck = false;
  edit.hidden = true;
  edit.setAttribute('aria-label', 'Edit this example');
  edit.rows = Math.min(18, Math.max(6, original.split('\n').length + 1));

  let stdin: HTMLTextAreaElement | null = null;
  if (exampleNeedsStdin(original)) {
    const stdinWrap = document.createElement('label');
    stdinWrap.className = 'jp-stdin jp-example-stdin';
    stdinWrap.append('Standard input');
    stdin = document.createElement('textarea');
    stdin.rows = 3;
    stdin.spellcheck = false;
    stdin.setAttribute('aria-label', 'Standard input');
    stdinWrap.append(stdin);
    tools.append(stdinWrap);
  }

  const actions = document.createElement('div');
  actions.className = 'jp-actions jp-example-actions';

  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'jp-btn jp-btn-run';
  runBtn.textContent = 'Run';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'jp-btn jp-btn-reset';
  editBtn.textContent = 'Edit';

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'jp-btn jp-btn-reset';
  resetBtn.textContent = 'Reset';

  const status = document.createElement('span');
  status.className = 'jp-status jp-example-status';
  status.setAttribute('aria-live', 'polite');

  actions.append(runBtn, editBtn, resetBtn, status);

  const consoleWrap = document.createElement('div');
  consoleWrap.className = 'jp-console jp-console-empty jp-example-console';
  consoleWrap.hidden = true;
  const consoleHeader = document.createElement('div');
  consoleHeader.className = 'jp-console-header';
  consoleHeader.textContent = 'Output';
  const consolePre = document.createElement('pre');
  consoleWrap.append(consoleHeader, consolePre);

  const note = document.createElement('p');
  note.className = 'jp-footnote jp-example-note';
  note.textContent =
    'Runs in the browser as Java 8. Robot libraries are not included. Infinite loops can freeze the tab.';

  tools.append(edit, actions, consoleWrap);
  if (!document.querySelector('.jp-example-note')) {
    tools.append(note);
  }
  root.append(tools);

  const showConsole = (kind: 'out' | 'error' | 'empty', text: string) => {
    consoleWrap.hidden = false;
    consoleWrap.classList.remove('jp-console-empty', 'jp-console-error');
    if (kind === 'error') consoleWrap.classList.add('jp-console-error');
    if (kind === 'empty') consoleWrap.classList.add('jp-console-empty');
    consolePre.textContent = text;
  };

  editBtn.addEventListener('click', () => {
    const open = edit.hidden;
    edit.hidden = !open;
    editBtn.textContent = open ? 'Hide editor' : 'Edit';
    if (open) edit.focus();
  });

  resetBtn.addEventListener('click', () => {
    edit.value = original;
    if (stdin) stdin.value = '';
    consoleWrap.hidden = true;
    consolePre.textContent = '';
    status.textContent = '';
  });

  runBtn.addEventListener('click', async () => {
    setBusy(root, true);
    status.textContent = 'Starting…';
    try {
      const result = await compileAndRunExample(
        edit.value,
        stdin?.value ?? '',
        (message) => {
          status.textContent = message;
        },
      );
      if (result.compileFailed) {
        showConsole('error', result.compileOutput || 'Compilation failed.');
      } else if (result.noMain) {
        showConsole('empty', NO_MAIN_MESSAGE);
      } else {
        const parts = [result.stdout, result.stderr.trim() ? result.stderr : ''].filter(
          (part) => part.length > 0,
        );
        const joined = parts.join(result.stdout && result.stderr.trim() ? '\n' : '');
        showConsole(result.stderr.trim() ? 'error' : 'out', joined.length > 0 ? joined : '(no output)');
      }
    } catch (err) {
      showConsole('error', err instanceof Error ? err.message : String(err));
    } finally {
      status.textContent = '';
      setBusy(root, false);
    }
  });
}

export function hydrateJavaExamples() {
  document.querySelectorAll<HTMLElement>('[data-jp-example]').forEach(mountExample);
}
