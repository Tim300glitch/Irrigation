/**
 * Light/dark theme. The app's dark styles hang off a `.dark` class; hosts that
 * embed the page (e.g. the artifact viewer) manage the root element's
 * attributes themselves and can wipe that class. So the choice lives here, is
 * applied to both <html> and <body>, and is re-applied whenever the root
 * changes. With no explicit choice it follows the host's `data-theme`, then
 * the OS preference.
 */
type Pref = "dark" | "light" | null;

const KEY = "crm-theme";
const subs = new Set<() => void>();
let pref: Pref = null;
let installed = false;
let current = false;

function readPref(): Pref {
  try {
    const t = localStorage.getItem(KEY);
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

function systemDark(): boolean {
  const host = document.documentElement.getAttribute("data-theme");
  if (host === "dark") return true;
  if (host === "light") return false;
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

function apply() {
  const dark = pref ? pref === "dark" : systemDark();
  for (const el of [document.documentElement, document.body]) {
    if (el && el.classList.contains("dark") !== dark) el.classList.toggle("dark", dark);
  }
  if (dark !== current) {
    current = dark;
    subs.forEach((f) => f());
  }
}

export function installTheme() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  pref = readPref();
  current = document.documentElement.classList.contains("dark");
  apply();
  new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  if (document.body) new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", apply);
  } catch {}
}

export function setDarkTheme(dark: boolean) {
  pref = dark ? "dark" : "light";
  try {
    localStorage.setItem(KEY, pref);
  } catch {}
  apply();
}

export const themeStore = {
  subscribe(f: () => void) {
    subs.add(f);
    return () => subs.delete(f);
  },
  isDark: () => current,
  serverIsDark: () => false,
};
