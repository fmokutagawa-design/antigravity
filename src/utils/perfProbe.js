export function perfEnabled() {
  return true;
}

export function perfNow() {
  return performance.now();
}

export function perfLog(scope, data = {}) {
  if (!perfEnabled()) return;
  try {
    console.log('[PERF]', JSON.stringify({
      scope,
      at: performance.now(),
      ...data,
    }));
  } catch (e) {
    console.log('[PERF]', scope, data);
  }
}

export function perfMeasure(scope, t0, data = {}) {
  if (!perfEnabled()) return;
  perfLog(scope, {
    ms: performance.now() - t0,
    ...data,
  });
}
