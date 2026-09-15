import {
  applyExplicitVisionPath,
  initialVisionPath,
  VISION_CHANGE_EVENT,
  type VisionPath,
} from './pathClient';
import { VISION_TAB_GROUP, parseVisionPath } from './path';

const INITIALIZED = 'data-initialized';

interface TabBlock {
  container: HTMLElement;
  group: string | null;
  buttons: HTMLButtonElement[];
  panels: HTMLElement[];
  copyBtn: HTMLButtonElement | null;
  activeIndex: number;
}

const blocks = new WeakMap<HTMLElement, TabBlock>();

function panelValue(panel: HTMLElement, index: number): string {
  return panel.dataset.tabValue || `index-${index}`;
}

function findIndex(block: TabBlock, value: string): number {
  return block.panels.findIndex((panel, index) => panelValue(panel, index) === value);
}

function setActive(block: TabBlock, index: number, options: { focus?: boolean } = {}): void {
  if (index < 0 || index >= block.panels.length) return;
  block.activeIndex = index;
  block.buttons.forEach((button, i) => {
    const selected = i === index;
    button.classList.toggle('active', selected);
    button.dataset.active = selected ? 'true' : 'false';
    button.setAttribute('aria-selected', selected ? 'true' : 'false');
    button.tabIndex = selected ? 0 : -1;
  });
  block.panels.forEach((panel, i) => {
    const selected = i === index;
    panel.classList.toggle('active', selected);
    panel.hidden = !selected;
  });
  if (options.focus) {
    block.buttons[index]?.focus();
  }
}

function syncGroup(group: string, value: string, source: EventTarget | null): void {
  document.querySelectorAll<HTMLElement>('[data-code-tabs]').forEach((container) => {
    if (container === source) return;
    if (container.dataset.tabGroup !== group) return;
    const block = blocks.get(container);
    if (!block) return;
    const index = findIndex(block, value);
    if (index >= 0) setActive(block, index);
  });
}

function onGroupSelect(block: TabBlock, value: string): void {
  if (block.group !== VISION_TAB_GROUP) return;
  const parsed = parseVisionPath(value);
  if (!parsed) return;
  applyExplicitVisionPath(parsed, block.container);
}

function restoreGroup(block: TabBlock): void {
  if (block.group !== VISION_TAB_GROUP) return;
  const stored = initialVisionPath();
  const index = findIndex(block, stored);
  setActive(block, index >= 0 ? index : 0);
}

function ensureButtons(container: HTMLElement): {
  buttons: HTMLButtonElement[];
  panels: HTMLElement[];
} {
  const wrapper = container.querySelector<HTMLElement>('.code-tabs-wrapper');
  const panels = Array.from(container.querySelectorAll<HTMLElement>('.code-tab-content'));
  let buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.code-tab-button'));

  if (container.dataset.codeTabsMode === 'slots' && wrapper && buttons.length === 0) {
    panels.forEach((panel, index) => {
      panel.dataset.tabPanel = String(index);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-tab-button';
      btn.dataset.tabIndex = String(index);
      if (panel.dataset.tabValue) btn.dataset.tabValue = panel.dataset.tabValue;
      btn.textContent = panel.dataset.tabLabel ?? `Tab ${index + 1}`;
      wrapper.appendChild(btn);
    });
    buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('.code-tab-button'));
  }

  return { buttons, panels };
}

function bindA11y(block: TabBlock): void {
  const tablist = block.container.querySelector<HTMLElement>('.code-tabs-wrapper');
  if (tablist) {
    tablist.setAttribute('role', 'tablist');
  }

  block.buttons.forEach((button, index) => {
    const panel = block.panels[index];
    const buttonId = button.id || `${block.container.id}-tab-${index}`;
    const panelId = panel.id || `${block.container.id}-panel-${index}`;
    button.id = buttonId;
    panel.id = panelId;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panelId);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', buttonId);
    button.addEventListener('click', () => {
      setActive(block, index, { focus: true });
      onGroupSelect(block, panelValue(panel, index));
    });
    button.addEventListener('keydown', (event) => {
      let next = -1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (index + 1) % block.buttons.length;
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (index - 1 + block.buttons.length) % block.buttons.length;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = block.buttons.length - 1;
      }
      if (next < 0) return;
      event.preventDefault();
      setActive(block, next, { focus: true });
      onGroupSelect(block, panelValue(block.panels[next], next));
    });
  });

  block.copyBtn?.addEventListener('click', async () => {
    const activePanel = block.panels[block.activeIndex];
    const code = activePanel?.querySelector('code')?.textContent ?? '';
    const text = block.copyBtn?.querySelector('.copy-text');
    try {
      await navigator.clipboard.writeText(code);
      if (text && block.copyBtn) {
        text.textContent = 'Copied!';
        block.copyBtn.classList.add('copied');
        setTimeout(() => {
          text.textContent = 'Copy';
          block.copyBtn?.classList.remove('copied');
        }, 2000);
      }
    } catch {
      if (text) {
        text.textContent = 'Failed';
        setTimeout(() => {
          text.textContent = 'Copy';
        }, 2000);
      }
    }
  });
}

function initBlock(container: HTMLElement): void {
  if (container.getAttribute(INITIALIZED)) return;
  container.setAttribute(INITIALIZED, 'true');

  const { buttons, panels } = ensureButtons(container);
  const block: TabBlock = {
    container,
    group: container.dataset.tabGroup || null,
    buttons,
    panels,
    copyBtn: container.querySelector('[data-copy-tabs]'),
    activeIndex: 0,
  };
  blocks.set(container, block);
  bindA11y(block);
  if (block.group === VISION_TAB_GROUP) {
    restoreGroup(block);
  } else {
    setActive(block, 0);
  }
}

let listenersBound = false;

function bindGlobalListeners(): void {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener(VISION_CHANGE_EVENT, (event) => {
    const custom = event as CustomEvent<{ value: VisionPath; source: EventTarget | null }>;
    const value = custom.detail?.value;
    if (!value) return;
    syncGroup(VISION_TAB_GROUP, value, custom.detail.source);
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== 'mantik-frc-vision') return;
    const value = parseVisionPath(event.newValue);
    if (!value) return;
    syncGroup(VISION_TAB_GROUP, value, null);
  });

  document.addEventListener('astro:page-load', () => {
    document.querySelectorAll<HTMLElement>('[data-code-tabs]').forEach(initBlock);
  });
}

export function initCodeTabs(): void {
  bindGlobalListeners();
  document.querySelectorAll<HTMLElement>('[data-code-tabs]').forEach(initBlock);
}
