/**
 * Router for the single-file build. The current route ("/path?query") lives in
 * memory, so navigation works even where the host frame does not let the page
 * change its URL (hosted artifact viewers). When the URL hash is writable it is
 * mirrored there too, so reloads and shared links keep working locally.
 * In the Next.js app this is never installed and normal URLs are used.
 */
export interface SpaRouter {
  get(): string;
  push(url: string): void;
  replace(url: string): void;
  back(): void;
  subscribe(cb: () => void): () => void;
}

const KEY = "__SPA_ROUTER__";

export function spaRouter(): SpaRouter | undefined {
  return typeof window === "undefined" ? undefined : (window as unknown as Record<string, SpaRouter | undefined>)[KEY];
}

export function installSpaRouter(): SpaRouter {
  const fromHash = () => {
    try {
      const h = window.location.hash;
      return h.startsWith("#/") ? h.slice(1) : null;
    } catch {
      return null;
    }
  };
  let current = fromHash() ?? "/";
  const stack: string[] = [];
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());
  const mirror = (url: string) => {
    try {
      history.replaceState(history.state, "", `#${url}`);
    } catch {
      /* host frame does not allow URL changes; memory route still works */
    }
  };
  const go = (url: string, replace: boolean) => {
    const next = url.startsWith("/") ? url : `/${url.replace(/^#\/?/, "")}`;
    if (next === current) return;
    if (!replace) stack.push(current);
    current = next;
    mirror(next);
    notify();
  };
  const router: SpaRouter = {
    get: () => current,
    push: (u) => go(u, false),
    replace: (u) => go(u, true),
    back: () => {
      const prev = stack.pop();
      if (prev === undefined) return;
      current = prev;
      mirror(prev);
      notify();
    },
    subscribe: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
  // the person typed a new hash / used the browser back button
  window.addEventListener("hashchange", () => {
    const h = fromHash();
    if (h && h !== current) {
      stack.push(current);
      current = h;
      notify();
    }
  });
  (window as unknown as Record<string, SpaRouter>)[KEY] = router;
  return router;
}
