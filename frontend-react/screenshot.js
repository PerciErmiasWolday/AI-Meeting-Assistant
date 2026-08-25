import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.argv[2] || "http://localhost:5173";
const ROUTE = process.argv[3] || "/dashboard";
const LABEL = process.argv[4] || ROUTE.replace(/\//g, "_") || "root";

const outDir = path.join(__dirname, "temporary-screenshots");

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1672, height: 941 });
await page.goto(`${BASE_URL}${ROUTE}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 300));

const fs = await import("node:fs");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${LABEL}.png`);
await page.screenshot({ path: outPath, fullPage: false });

await browser.close();
console.log("saved:", outPath);
