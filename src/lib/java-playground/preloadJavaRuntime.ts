/** Warm-cache CheerpJ + ECJ after first paint so the first Run is shorter. */
export function preloadJavaRuntimeOnIdle(): void {
  const preload = () => {
    void import('./cheerpjRunner').then((mod) => {
      void mod.preloadJavaRuntime();
    });
  };
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(preload, { timeout: 2000 });
  } else {
    setTimeout(preload, 200);
  }
}
