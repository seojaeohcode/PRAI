// Screens of the real product + the boxes to zoom into, from a capture plan.
// Uses playwright-core with a browser already on the machine (Edge or Chrome channel) — nothing to download.
// Output: public/shots/<name>.png (at `scale`× for sharp zooms) and public/shots/rects.json:
//   { "_page": {w, h}, "<shot>": { "<key>": {x, y, w, h} | null } }   (CSS px of the viewport)
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Sel = string | string[];
export type Step =
  | { goto: string; wait?: number }
  | { click: string; wait?: number }
  | { fill: [string, string] }
  | { type: [string, string]; delay?: number }
  | { press: string }
  | { upload: [string, string | string[]] }
  | { wait: number | string }
  | { scroll: string }
  | { eval: string }
  | { shot: string; rects?: Record<string, Sel>; fullPage?: false };
export type CapturePlan = {
  url?: string;                    // the app's address, or…
  serve?: string;                  // …a folder (relative to the project) served on a free local port
  browser?: "msedge" | "chrome" | "chromium";
  executablePath?: string;
  viewport?: { width: number; height: number };
  scale?: number;
  colorScheme?: "light" | "dark";
  locale?: string;                 // e.g. "en-US" (default: the machine's)
  steps?: Step[];
  script?: string;                 // or a module: export default async ({ page, shot, base }) => { … }  (shot(name, selectors, boxes))
};

function serveFolder(dir: string): Promise<{ url: string; close: () => void }> {
  const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    let rel: string;
    try { rel = decodeURIComponent((req.url || "/").split("?")[0]); } catch { res.writeHead(400); return res.end(); }
    let p = path.resolve(dir, "." + rel);
    const inside = path.relative(path.resolve(dir), p);
    if (inside.startsWith("..") || path.isAbsolute(inside)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    fs.createReadStream(p).on("error", () => res.end()).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    const port = (server.address() as any).port;
    resolve({ url: `http://127.0.0.1:${port}`, close: () => server.close() });
  }));
}

export async function capture(projectDir: string, plan: CapturePlan, only?: string[]) {
  let pw: typeof import("playwright-core");
  try { pw = await import("playwright-core"); } catch { throw new Error("playwright-core is not installed: npm i playwright-core"); }
  const outDir = path.join(projectDir, "public", "shots");
  fs.mkdirSync(outDir, { recursive: true });
  const rectsFile = path.join(outDir, "rects.json");
  const rects: Record<string, any> = fs.existsSync(rectsFile) ? JSON.parse(fs.readFileSync(rectsFile, "utf8")) : {};
  const vp = plan.viewport ?? { width: 1920, height: 1080 };
  rects._page = { w: vp.width, h: vp.height };
  const srv = plan.serve ? await serveFolder(path.resolve(projectDir, plan.serve)) : null;
  const base = (srv?.url ?? plan.url ?? "").replace(/\/$/, "");
  let browser: import("playwright-core").Browser;
  try {
    browser = await pw.chromium.launch({ headless: true, executablePath: plan.executablePath,
      channel: plan.executablePath ? undefined : plan.browser === "chromium" ? undefined : plan.browser ?? "msedge" });
  } catch (e: any) {
    srv?.close();
    throw new Error(`could not start the browser (${plan.executablePath ?? plan.browser ?? "msedge"}): ${String(e.message).split(/\r?\n/)[0]}. ` +
      `Install Edge or Chrome, or set "browser"/"executablePath" in capture.json.`);
  }
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: plan.scale ?? 2, colorScheme: plan.colorScheme ?? "light", locale: plan.locale });
  // passed as a string: tsx/esbuild would wrap a real function with helpers the page does not have
  const MEASURE = `(m) => {
    const R = (s) => {
      const nodes = (Array.isArray(s) ? s : [s]).flatMap((q) => [...document.querySelectorAll(q)]);
      const v = nodes.filter((n) => n.getClientRects().length).map((n) => n.getBoundingClientRect());
      if (!v.length) return null;
      const x = Math.min(...v.map((r) => r.left)), y = Math.min(...v.map((r) => r.top));
      return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(...v.map((r) => r.right)) - x), h: Math.round(Math.max(...v.map((r) => r.bottom)) - y) };
    };
    return Object.fromEntries(Object.entries(m).map(([k, s]) => [k, R(s)]));
  }`;
  const measure = (sels: Record<string, Sel>) => page.evaluate(`(${MEASURE})(${JSON.stringify(sels)})`) as Promise<Record<string, any>>;
  // `boxes`: rectangles you know yourself (things drawn on a canvas are not DOM elements)
  const shot = async (name: string, sels: Record<string, Sel> = {}, boxes: Record<string, { x: number; y: number; w: number; h: number }> = {}) => {
    if (!/^[\w-]+$/.test(name)) throw new Error(`shot name "${name}" must be letters, digits, - or _`);
    if (only?.length && !only.includes(name)) return;
    await page.waitForTimeout(300);
    rects[name] = { ...(await measure(sels)), ...boxes };
    await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    const missing = Object.entries(rects[name]).filter(([, v]) => !v).map(([k]) => k);
    console.log(`  shot ${name}${missing.length ? `  (not found: ${missing.join(", ")})` : ""}`);
  };
  const resolveUrl = (u: string) => (/^https?:/.test(u) ? u : base + (u.startsWith("/") ? u : "/" + u));
  try {
    if (plan.script) {
      const mod = await import(pathToFileURL(path.resolve(projectDir, plan.script)).href);
      await mod.default({ page, shot, base, resolveUrl });
    }
    for (const s of plan.steps ?? []) {
      if ("goto" in s) { await page.goto(resolveUrl(s.goto)); await page.waitForTimeout(s.wait ?? 500); }
      else if ("click" in s) { await page.click(s.click); await page.waitForTimeout(s.wait ?? 250); }
      else if ("fill" in s) await page.fill(s.fill[0], s.fill[1]);
      else if ("type" in s) await page.locator(s.type[0]).pressSequentially(s.type[1], { delay: s.delay ?? 20 });
      else if ("press" in s) await page.keyboard.press(s.press);
      else if ("upload" in s) await page.setInputFiles(s.upload[0], ([] as string[]).concat(s.upload[1]).map((f) => path.resolve(projectDir, f)));
      else if ("wait" in s) { if (typeof s.wait === "number") await page.waitForTimeout(s.wait); else await page.waitForSelector(s.wait); }
      else if ("scroll" in s) await page.locator(s.scroll).scrollIntoViewIfNeeded();
      else if ("eval" in s) await page.evaluate(s.eval);
      else if ("shot" in s) await shot(s.shot, s.rects);
    }
  } finally {
    fs.writeFileSync(rectsFile, JSON.stringify(rects, null, 1));
    await browser.close();
    srv?.close();
  }
  return rects;
}
