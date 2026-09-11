import { dumpCheerpjResources, preloadJavaRuntime } from './cheerpjRunner';

/** Start Java and warm the compiler immediately, independently of editor hydration. */
export function preloadJavaRuntimeSoon(): void {
  if (typeof window !== 'undefined') {
    (window as unknown as { __jpDumpResources?: typeof dumpCheerpjResources }).__jpDumpResources =
      dumpCheerpjResources;
  }
  void preloadJavaRuntime().catch(() => {
    // Background startup is optional; Run reports errors and allows a retry.
  });
}
