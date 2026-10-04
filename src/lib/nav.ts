/** Query parameters for the current page — works with normal URLs and with the
 *  single-file build, which routes inside the hash (#/projects?q=…). */
import { spaRouter } from "./spaRouter";

export function searchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const r = spaRouter();
  if (r) {
    const u = r.get();
    const i = u.indexOf("?");
    return new URLSearchParams(i >= 0 ? u.slice(i + 1) : "");
  }
  const h = window.location.hash;
  if (h.startsWith("#/")) {
    const i = h.indexOf("?");
    return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
  }
  return new URLSearchParams(window.location.search);
}
