import { useSyncExternalStore } from "react";
import { spaRouter } from "@/lib/spaRouter";

/** next/navigation replacement for the single-file build (in-memory router, see spaRouter.ts). */
const r = () => spaRouter()!;
const path = () => r().get().split("#")[0].split("?")[0] || "/";
const query = () => {
  const u = r().get();
  const i = u.indexOf("?");
  return i >= 0 ? u.slice(i + 1) : "";
};
export function usePathname() {
  return useSyncExternalStore((cb) => r().subscribe(cb), path, () => "/");
}
export function useRouter() {
  return { push: (url: string) => r().push(url), replace: (url: string) => r().replace(url), back: () => r().back() };
}
export function useSearchParams() {
  return new URLSearchParams(useSyncExternalStore((cb) => r().subscribe(cb), query, () => ""));
}
