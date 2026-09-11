import { dumpCheerpjResources, preloadJavaRuntime } from './cheerpjRunner';
import type { StatusFn } from './types';

/** Start Java and warm the compiler immediately, independently of editor hydration. */
export function preloadJavaRuntimeSoon(onStatus?: StatusFn): Promise<void> {
  if (typeof window !== 'undefined') {
    (window as unknown as { __jpDumpResources?: typeof dumpCheerpjResources }).__jpDumpResources =
      dumpCheerpjResources;
  }
  return preloadJavaRuntime(onStatus);
}
