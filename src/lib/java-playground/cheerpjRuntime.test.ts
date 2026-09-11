import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Java warmup readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('cheerpjInit', vi.fn().mockResolvedValue(undefined));
    vi.stubGlobal('cheerpOSAddStringFile', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('rejects failed compilation rather than reporting a ready compiler', async () => {
    vi.stubGlobal('cheerpjRunMain', vi.fn().mockResolvedValue(1));
    const { ensureRuntime } = await import('./cheerpjRuntime');
    await expect(ensureRuntime()).rejects.toThrow('Compilation failed.');
    await expect(ensureRuntime()).rejects.toThrow('Compilation failed.');
  });

  it('rejects an unfinished warmup program rather than reporting a ready runtime', async () => {
    vi.stubGlobal('cheerpjRunMain', vi.fn().mockResolvedValue(0));
    const { ensureRuntime } = await import('./cheerpjRuntime');
    await expect(ensureRuntime()).rejects.toThrow('The program did not finish.');
  });
});
