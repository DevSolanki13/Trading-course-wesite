const pending = new Map<string, Promise<void>>();

/** Warm only artwork present on this page, on theme-switch intent rather than startup. */
export function warmThemeBrandAssets(theme: string): Promise<void> {
  const selector =
    theme === "light"
      ? "img.brand-logo-light, img.brand-mark-light"
      : "img.brand-logo-dark, img.brand-mark-dark";
  const urls = new Set(
    Array.from(document.querySelectorAll<HTMLImageElement>(selector), (img) => img.src),
  );
  return Promise.all(
    Array.from(urls, (src) => {
      const existing = pending.get(src);
      if (existing) return existing;
      const loaded = new Promise<void>((resolve) => {
        const image = new Image();
        // A broken/slow asset must never leave the theme control stuck.
        const timeout = window.setTimeout(finish, 1200);
        function finish() {
          window.clearTimeout(timeout);
          image.onload = null;
          image.onerror = null;
          resolve();
        }
        image.onload = () => {
          if (image.decode)
            void image
              .decode()
              .catch(() => {})
              .finally(finish);
          else finish();
        };
        image.onerror = finish;
        image.src = src;
      });
      pending.set(src, loaded);
      void loaded.then(() => pending.delete(src));
      return loaded;
    }),
  ).then(() => {});
}
