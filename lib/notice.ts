/** A tiny app-wide notice channel (shown by components/StorageErrorBanner.tsx). */

const listeners = new Set<(message: string) => void>();

export function showNotice(message: string) {
  listeners.forEach((l) => l(message));
}

export function onNotice(listener: (message: string) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
