// Shoots excalidraw.com while drawing a small architecture sketch. Canvas shapes are not DOM elements, so their
// boxes are passed to shot() directly (we know where we drew them).
const box = (x1, y1, x2, y2) => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
export default async function ({ page, shot }) {
  await page.goto("https://excalidraw.com", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("canvas"); await page.waitForTimeout(2500);
  const ui = { toolbar: ".App-toolbar", rect: '[data-testid="toolbar-rectangle"]', arrow: '[data-testid="toolbar-arrow"]', ellipse: '[data-testid="toolbar-ellipse"]',
    text: '[data-testid="toolbar-text"]', share: ".excalidraw-button.collab-button, [data-testid='share-button']", menu: '[data-testid="main-menu-trigger"]' };
  await shot("blank", { ...ui, welcome: ".welcome-screen-center" });
  const drag = async (x1, y1, x2, y2) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 6 }); await page.mouse.move(x2, y2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150); };
  const label = async (text) => { await page.keyboard.press("Enter"); await page.waitForTimeout(150); await page.keyboard.type(text, { delay: 15 }); await page.keyboard.press("Escape"); await page.waitForTimeout(150); };
  const A = box(520, 430, 780, 570), B = box(900, 430, 1160, 570), C = box(1280, 430, 1540, 570);
  await page.keyboard.press("r"); await drag(A.x, A.y, A.x + A.w, A.y + A.h); await label("Browser");
  await shot("one", { ...ui }, { A });
  await page.keyboard.press("r"); await drag(B.x, B.y, B.x + B.w, B.y + B.h); await label("API");
  await page.keyboard.press("o"); await drag(C.x, C.y, C.x + C.w, C.y + C.h); await label("Postgres");
  await page.keyboard.press("a"); await drag(A.x + A.w + 6, 500, B.x - 6, 500);
  await page.keyboard.press("a"); await drag(B.x + B.w + 6, 500, C.x - 6, 500);
  await page.keyboard.press("t"); await page.mouse.click(A.x, 340); await page.keyboard.type("Checkout flow", { delay: 15 }); await page.keyboard.press("Escape");
  await page.keyboard.press("v"); await page.mouse.click(960, 900); await page.waitForTimeout(300);
  const all = box(A.x - 10, 320, C.x + C.w + 10, C.y + C.h + 10);
  await shot("flow", { ...ui }, { A, B, C, all, arrows: box(A.x + A.w, 470, C.x, 530), title: box(A.x - 6, 326, A.x + 330, 384) });
  await page.keyboard.press("Control+a"); await page.waitForTimeout(400);
  // fill everything with a light blue (the 4th background swatch in the properties panel)
  const swatches = await page.evaluate(`(() => [...document.querySelectorAll(".App-menu__left button, .App-menu__left [role=radio], .App-menu__left .color-picker__button")].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), b.getAttribute("title") || b.getAttribute("aria-label") || ""]; }).filter(x => /light blue|#a5d8ff|blue/i.test(x[2])))()`);
  console.log("  swatches:", JSON.stringify(swatches.slice(0, 4)));
  if (swatches.length > 1) await page.mouse.click(swatches[1][0], swatches[1][1]); else await page.mouse.click(120, 184);
  await page.waitForTimeout(400);
  const panel = await page.evaluate(`(() => { const e = document.querySelector(".App-menu__left, .selected-shape-actions, .panelColumn"); if (!e) return null; const r = e.getBoundingClientRect(); return { cls: e.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  console.log("  properties panel:", JSON.stringify(panel));
  await shot("styled", { ...ui, panel: ".App-menu__left" }, { all });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+Shift+e"); await page.waitForTimeout(1200);
  const dlg = await page.evaluate(`(() => { const e = document.querySelector(".Modal__content, .Dialog, [role=dialog]"); if (!e) return null; const r = e.getBoundingClientRect(); return { cls: e.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  console.log("  export dialog:", JSON.stringify(dlg));
  await shot("export", { dialog: ".Modal__content", preview: ".ImageExportModal__preview, .ImageExportModal__preview__canvas", buttons: ".ImageExportModal__settings__buttons, .ImageExportModal__settings" });
}
