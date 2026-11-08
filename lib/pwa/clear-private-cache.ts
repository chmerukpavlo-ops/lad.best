/** Clears any non-shell caches and notifies the service worker. */
export async function clearPrivateClientCaches(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== "lad-shell-v1")
          .map((key) => caches.delete(key)),
      );
    }
  } catch {
    /* ignore */
  }

  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.active?.postMessage({ type: "CLEAR_PRIVATE" });
    }
  } catch {
    /* ignore */
  }
}
