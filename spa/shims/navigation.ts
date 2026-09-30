import { useSyncExternalStore } from "react";

/** next/navigation replacement: hash-based routing (#/path?query). */
function currentPath() {
  const h = window.location.hash.replace(/^#/, "") || "/";
  return h.split("#")[0].split("?")[0] || "/";
}
function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
export function usePathname() {
  return useSyncExternalStore(subscribe, currentPath, () => "/");
}
export function useRouter() {
  return {
    push: (url: string) => {
      window.location.hash = url;
    },
    replace: (url: string) => {
      window.location.hash = url;
    },
    back: () => history.back(),
  };
}
export function useSearchParams() {
  const h = window.location.hash;
  const i = h.indexOf("?");
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
}
