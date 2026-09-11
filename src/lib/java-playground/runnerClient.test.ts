import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerReply, WorkerRequest } from './protocol';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: WorkerReply }) => void;
  onerror?: (event: { message: string }) => void;
  messages: WorkerRequest[] = [];
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  postMessage(message: WorkerRequest) { this.messages.push(message); }
  reply(data: WorkerReply) { this.onmessage?.({ data }); }
}

const source = 'public class Main { public static void main(String[] args) {} }';
const result = { ok: true, compileFailed: false, compileOutput: '', stdout: 'done', stderr: '', exitCode: 0 };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('shared Java runner', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shares startup and forwards warmup progress to a waiting Run', async () => {
    const client = await import('./runnerClient');
    const first = client.preloadJavaRuntime();
    const second = client.preloadJavaRuntime();
    const status = vi.fn();
    const run = client.compileAndRun(source, '', status);
    await flush();
    const worker = FakeWorker.instances[0];
    expect(worker.messages.map((message) => message.type)).toEqual(['init']);
    const id = worker.messages[0].id;
    worker.reply({ id, type: 'status', message: 'Warming up compiler…' });
    expect(status).toHaveBeenLastCalledWith('Warming up compiler…');
    worker.reply({ id, type: 'result', result: null });
    await Promise.all([first, second]);
    await flush();
    expect(worker.messages.map((message) => message.type)).toEqual(['init', 'compile-run']);
    worker.reply({ id: worker.messages[1].id, type: 'result', result });
    await expect(run).resolves.toEqual(result);
  });

  it('cancels both active and queued runs, then accepts a new run', async () => {
    const client = await import('./runnerClient');
    const active = client.compileAndRun(source).catch((error: Error) => error.name);
    const queued = client.compileAndRun(source).catch((error: Error) => error.name);
    await flush();
    const oldWorker = FakeWorker.instances[0];
    client.cancel();
    await expect(active).resolves.toBe('JavaRunCancelledError');
    await expect(queued).resolves.toBe('JavaRunCancelledError');
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    expect(oldWorker.messages).toHaveLength(1);
    await flush();
    const newWorker = FakeWorker.instances[1];
    expect(newWorker.messages.map((message) => message.type)).toEqual(['init']);
    newWorker.reply({ id: newWorker.messages[0].id, type: 'result', result: null });
    await flush();
    const next = client.compileAndRun(source);
    await flush();
    newWorker.reply({ id: newWorker.messages[1].id, type: 'result', result });
    await expect(next).resolves.toEqual(result);
  });
});
