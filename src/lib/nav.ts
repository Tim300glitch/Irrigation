/** Query parameters for the current page — works with normal URLs and with the
 *  single-file build, which routes inside the hash (#/projects?q=…). */
export function searchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  const h = window.location.hash;
  if (h.startsWith("#/")) {
    const i = h.indexOf("?");
    return new URLSearchParams(i >= 0 ? h.slice(i + 1) : "");
  }
  return new URLSearchParams(window.location.search);
}
