import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installJavaPageStartup } from './pageStartup';

const preload = vi.hoisted(() => vi.fn());
vi.mock('./preloadJavaRuntime', () => ({ preloadJavaRuntimeSoon: preload }));
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function page(readyState: string, hasCode: boolean) {
  const events = new EventTarget();
  const indicator = { hidden: true, textContent: '' };
  const doc = {
    readyState,
    addEventListener: events.addEventListener.bind(events),
    querySelector: (selector: string) => selector === '[data-jp-runtime-status]'
      ? indicator : hasCode ? {} : null,
  } as unknown as Document;
  return { doc, events, indicator };
}

describe('proactive Java startup', () => {
  beforeEach(() => { preload.mockReset(); preload.mockResolvedValue(undefined); });

  it('starts without React hydration or a Run click and reports completion', async () => {
    const { doc, indicator } = page('complete', true);
    installJavaPageStartup(doc);
    expect(indicator.hidden).toBe(false);
    await flush();
    expect(preload).toHaveBeenCalledOnce();
    expect(indicator.textContent).toContain('Java ready');
  });

  it('waits for parsed markup and deduplicates the initial Astro page event', async () => {
    const { doc, events } = page('loading', true);
    installJavaPageStartup(doc);
    await flush();
    expect(preload).not.toHaveBeenCalled();
    events.dispatchEvent(new Event('DOMContentLoaded'));
    events.dispatchEvent(new Event('astro:page-load'));
    await flush();
    expect(preload).toHaveBeenCalledOnce();
  });

  it('does not start Java on a page without runnable code', async () => {
    const { doc, indicator } = page('complete', false);
    installJavaPageStartup(doc);
    await flush();
    expect(preload).not.toHaveBeenCalled();
    expect(indicator.hidden).toBe(true);
  });

  it('reports startup failures instead of silently swallowing them', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    preload.mockRejectedValueOnce(new Error('Network unavailable'));
    const { doc, indicator } = page('complete', true);
    installJavaPageStartup(doc);
    await flush();
    expect(indicator.textContent).toContain('Click Run to retry');
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
