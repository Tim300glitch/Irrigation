// Builds dist/deltaline-irrigation.html (standalone document) and
// dist/deltaline-artifact.html (body content for hosted artifact pages).
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
mkdirSync(path.join(root, "dist"), { recursive: true });
execSync(`npx @tailwindcss/cli -i src/app/globals.css -o dist/app.css --minify`, { cwd: root, stdio: "inherit" });
const res = await build({
  entryPoints: [path.join(root, "spa/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  write: false,
  jsx: "automatic",
  loader: { ".mjs": "js" },
  plugins: [
    {
      name: "text-worker",
      setup(b) {
        b.onLoad({ filter: /pdf\.worker\.min\.mjs$/ }, (a) => ({ contents: readFileSync(a.path, "utf8"), loader: "text" }));
      },
    },
  ],
  alias: {
    "next/link": path.join(root, "spa/shims/link.tsx"),
    "next/navigation": path.join(root, "spa/shims/navigation.ts"),
    "@": path.join(root, "src"),
  },
  define: { "process.env.NODE_ENV": '"production"', "import.meta.url": '"https://localhost/"' },
  logLevel: "warning",
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = readFileSync(path.join(root, "dist/app.css"), "utf8").replace(/<\/style/gi, "<\\/style");
const head = `<title>DeltaLine Irrigation CRM</title>
<meta name="description" content="Professional landscape irrigation design: site drawing, sprinkler layout, zoning, hydraulics, materials, estimates and PDF plans.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<script>try{var t=localStorage.getItem("crm-theme"),a=document.documentElement.getAttribute("data-theme");if(t==="dark"||(!t&&(a==="dark"||(a!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))))document.documentElement.classList.add("dark")}catch(e){}</script>
<style>:root{color-scheme:light}html,body{height:100%;background:#f5f7f9;color:#0f172a}.dark body{background:#0b111a;color:#e8edf4}</style>
<style>${css}</style>`;
const body = `<div id="root"><div style="display:flex;height:100vh;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;color:#64748b">Loading DeltaLine Irrigation CRM…</div></div>
<script>${js}</script>`;
writeFileSync(path.join(root, "dist/deltaline-irrigation.html"), `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${head}\n</head>\n<body class="font-sans text-[13px]">\n${body}\n</body>\n</html>\n`);
writeFileSync(path.join(root, "dist/deltaline-artifact.html"), `${head}\n<style>body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:13px;margin:0}</style>\n${body}\n`);
console.log("built", (js.length / 1e6).toFixed(2), "MB js,", (css.length / 1e3).toFixed(0), "KB css");
