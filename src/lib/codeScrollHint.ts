const HINT_ATTR = 'data-code-scroll-hint';
const MORE_ATTR = 'data-code-scroll-more';
const SLACK_PX = 24;

const PRE_SELECTOR = [
  '.lesson-content pre.astro-code',
  '.exercise-box-body pre.astro-code',
  '.rules-box-content pre.astro-code',
  '.steps-box-content pre.astro-code',
].join(', ');

export interface OverflowState {
  below: boolean;
  above: boolean;
}

export function overflowState(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  slack = SLACK_PX,
): OverflowState {
  return {
    below: scrollHeight - clientHeight - scrollTop > slack,
    above: scrollTop > slack,
  };
}

function measure(el: HTMLElement): OverflowState {
  return overflowState(el.scrollTop, el.clientHeight, el.scrollHeight);
}

function isEffectivelyVisible(el: HTMLElement): boolean {
  if (el.closest('.answer-section.hidden')) return false;
  if (el.closest('[hidden]')) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return el.getClientRects().length > 0;
}

function ensureShell(pre: HTMLElement): HTMLElement {
  const parent = pre.parentElement;
  if (parent?.classList.contains('code-scroll-shell')) return parent;

  const shell = document.createElement('div');
  shell.className = 'code-scroll-shell';
  parent?.insertBefore(shell, pre);
  shell.append(pre);
  return shell;
}

function ensureHint(frame: HTMLElement): HTMLElement {
  const existing = frame.querySelector<HTMLElement>(`:scope > [${HINT_ATTR}]`);
  if (existing) return existing;

  const hint = document.createElement('div');
  hint.className = 'code-scroll-hint';
  hint.setAttribute(HINT_ATTR, '');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-scroll-hint__btn';
  button.setAttribute(MORE_ATTR, '');
  button.setAttribute('aria-label', 'Scroll to see the rest of this example');

  const label = document.createElement('span');
  label.className = 'code-scroll-hint__text';
  label.textContent = 'Scroll to see the rest';

  const chevron = document.createElement('span');
  chevron.className = 'code-scroll-hint__chevron';
  chevron.setAttribute('aria-hidden', 'true');

  button.append(label, chevron);
  hint.append(button);
  frame.append(hint);
  return hint;
}

function uniqueElements(nodes: Array<HTMLElement | null>): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const out: HTMLElement[] = [];
  for (const node of nodes) {
    if (!node || seen.has(node)) continue;
    seen.add(node);
    out.push(node);
  }
  return out;
}

interface ScrollTarget {
  frame: HTMLElement;
  scrollers: HTMLElement[];
  hint: HTMLElement;
}

function collectTargets(root: ParentNode): ScrollTarget[] {
  const targets: ScrollTarget[] = [];
  const seenFrames = new Set<HTMLElement>();

  const add = (frame: HTMLElement, scrollers: HTMLElement[]) => {
    if (seenFrames.has(frame)) return;
    const list = uniqueElements(scrollers);
    if (list.length === 0) return;
    seenFrames.add(frame);
    targets.push({ frame, scrollers: list, hint: ensureHint(frame) });
  };

  root.querySelectorAll<HTMLElement>('.code-tabs-container').forEach((frame) => {
    add(frame, [
      frame.querySelector<HTMLElement>('.code-tabs-content'),
      ...Array.from(frame.querySelectorAll<HTMLElement>('pre')),
    ]);
  });

  root.querySelectorAll<HTMLElement>('.code-block').forEach((frame) => {
    if (frame.closest('.code-tabs-container')) return;
    add(frame, [frame.querySelector<HTMLElement>('pre')]);
  });

  root.querySelectorAll<HTMLElement>(PRE_SELECTOR).forEach((pre) => {
    if (pre.closest('.code-tabs-container') || pre.closest('.code-block')) return;
    add(ensureShell(pre), [pre]);
  });

  return targets;
}

function combinedOverflow(scrollers: HTMLElement[]): OverflowState & { belowScroller: HTMLElement | null } {
  let below = false;
  let above = false;
  let belowScroller: HTMLElement | null = null;
  for (const scroller of scrollers) {
    const state = measure(scroller);
    if (state.below && !belowScroller) belowScroller = scroller;
    below ||= state.below;
    above ||= state.above;
  }
  return { below, above, belowScroller };
}

function syncTarget(target: ScrollTarget): void {
  const shown = isEffectivelyVisible(target.frame);
  const { below, above, belowScroller } = shown
    ? combinedOverflow(target.scrollers)
    : { below: false, above: false, belowScroller: null };
  target.frame.classList.toggle('has-code-overflow-below', below);
  target.frame.classList.toggle('has-code-overflow-above', above);
  for (const scroller of target.scrollers) {
    const state = shown ? measure(scroller) : { below: false, above: false };
    scroller.classList.toggle('is-code-scrollable', state.below || state.above);
  }
  target.hint.classList.toggle('is-visible', below);
  target.hint.setAttribute('aria-hidden', below ? 'false' : 'true');
  target.hint.toggleAttribute('inert', !below);
  target.hint.dataset.scrollerIndex = belowScroller
    ? String(target.scrollers.indexOf(belowScroller))
    : '';
}

let detach: (() => void) | null = null;

export function initCodeScrollHints(doc: Document = document): () => void {
  detach?.();

  const targets = collectTargets(doc);
  const cleanups: Array<() => void> = [];

  const syncAll = () => {
    for (const target of targets) syncTarget(target);
  };

  for (const target of targets) {
    const onScroll = () => syncTarget(target);
    const onMore = () => {
      const { belowScroller } = combinedOverflow(target.scrollers);
      const scroller = belowScroller ?? target.scrollers[0];
      scroller?.scrollBy({
        top: Math.max(160, Math.round(scroller.clientHeight * 0.7)),
        behavior: 'smooth',
      });
    };

    const moreBtn = target.hint.querySelector<HTMLButtonElement>(`[${MORE_ATTR}]`);
    moreBtn?.addEventListener('click', onMore);

    const observer = new ResizeObserver(onScroll);
    observer.observe(target.frame);
    for (const scroller of target.scrollers) {
      scroller.addEventListener('scroll', onScroll, { passive: true });
      observer.observe(scroller);
    }

    cleanups.push(() => {
      moreBtn?.removeEventListener('click', onMore);
      observer.disconnect();
      for (const scroller of target.scrollers) {
        scroller.removeEventListener('scroll', onScroll);
      }
    });
  }

  syncAll();
  doc.defaultView?.addEventListener('resize', syncAll);
  void doc.fonts?.ready.then(syncAll);

  const onActivate = () => {
    requestAnimationFrame(syncAll);
  };
  doc.addEventListener('click', onActivate);

  detach = () => {
    doc.defaultView?.removeEventListener('resize', syncAll);
    doc.removeEventListener('click', onActivate);
    for (const cleanup of cleanups) cleanup();
    detach = null;
  };

  return detach;
}
