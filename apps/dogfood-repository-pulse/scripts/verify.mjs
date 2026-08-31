import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createFixtureApi } from "./fixture-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checks = 0;

function check(condition, message, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${message}`);
    return;
  }
  failures.push(detail ? `${message}: ${detail}` : message);
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ""}`);
}

async function anyVisible(locator) {
  return locator.evaluateAll((nodes) =>
    nodes.some((node) => {
      const element = node;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    }),
  );
}

function buildWith(values) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npm run build"]
      : ["run", "build"];
  // pnpm経由でverifyを起動するとpnpm固有のnpm_config_*まで子npmへ渡り、
  // npmが「未知の設定」と警告します。buildには不要なので境界で落とします。
  const cleanEnvironment = { ...process.env };
  for (const name of Object.keys(cleanEnvironment)) {
    if (name.toLowerCase().startsWith("npm_config_")) delete cleanEnvironment[name];
  }
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: {
      ...cleanEnvironment,
      VITE_GITHUB_OWNER: "",
      VITE_GITHUB_REPO: "",
      VITE_GITHUB_API_URL: "",
      ...values,
    },
  });
  if (result.status !== 0) throw new Error(`build failed with exit code ${result.status}`);
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server has no TCP address");
  return address.port;
}

async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function createStaticServer() {
  const dist = path.join(root, "dist");
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    let target = path.resolve(dist, relative);
    if (!target.startsWith(`${dist}${path.sep}`) && target !== dist) {
      response.writeHead(400);
      response.end("bad path");
      return;
    }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      target = path.join(dist, "index.html");
    }
    const extension = path.extname(target);
    const contentType =
      extension === ".html"
        ? "text/html; charset=utf-8"
        : extension === ".js"
          ? "text/javascript; charset=utf-8"
          : extension === ".css"
            ? "text/css; charset=utf-8"
            : "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    fs.createReadStream(target).pipe(response);
  });
}

async function configurationCase(browser) {
  console.log("\nconfiguration boundary");
  buildWith({});
  const server = createStaticServer();
  const port = await listen(server);
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  try {
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Repository Pulse cannot start yet" }).waitFor();
    const alert = page.getByRole("alert");
    check(await alert.isVisible(), "missing config is a visible alert");
    const text = await alert.textContent();
    check(text?.includes("VITE_GITHUB_OWNER") === true, "alert names VITE_GITHUB_OWNER");
    check(text?.includes("VITE_GITHUB_REPO") === true, "alert names VITE_GITHUB_REPO");
    check(text?.includes("Do not add a GitHub token") === true, "alert repeats the secret boundary");
  } finally {
    await page.close();
    await close(server);
  }
}

async function applicationCase(browser) {
  console.log("\napplication paths");
  const api = createFixtureApi();
  const apiPort = await listen(api);
  buildWith({
    VITE_GITHUB_OWNER: "example",
    VITE_GITHUB_REPO: "pulse",
    VITE_GITHUB_API_URL: `http://127.0.0.1:${apiPort}/`,
  });
  const web = createStaticServer();
  const webPort = await listen(web);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await context.newPage();
  const runtimeErrors = [];
  let expectedServiceFailures = 0;
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (message.text().includes("503 (Service Unavailable)")) {
      expectedServiceFailures += 1;
      return;
    }
    runtimeErrors.push(`console: ${message.text()}`);
  });

  try {
    await page.goto(`http://127.0.0.1:${webPort}/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "example/pulse" }).waitFor();
    check(await page.getByText("1.2K").isVisible(), "repository summary renders parsed metrics");

    await page.locator("body").press("Home");
    await page.locator("body").press("Tab");
    check(
      (await page.evaluate(() => document.activeElement?.textContent?.trim())) === "Skip to main content",
      "first keyboard stop is the skip link",
    );
    await page.keyboard.press("Enter");
    check(await page.evaluate(() => document.activeElement?.id === "main"), "skip link focuses main content");

    const copy = page.getByRole("button", { name: "Copy repository URL" });
    await copy.click();
    await page.getByRole("button", { name: "Copied" }).waitFor();
    check(
      (await page.evaluate(() => navigator.clipboard.readText())) === "https://github.com/example/pulse",
      "CopyButton copies the public repository URL",
    );

    const search = page.getByRole("searchbox", { name: "Issue or pull request search" });
    await search.fill("malformed");
    await page.getByText("GitHub returned data this app does not understand.", { exact: false }).waitFor();
    check(true, "malformed 200 response fails closed without a render error");

    await search.fill("slow");
    await page.waitForTimeout(380);
    await search.fill("release");
    await page.getByRole("link", { name: /Release checklist for v2\.1/ }).waitFor();
    await page.waitForTimeout(750);
    check(
      (await page.getByText("Stale slow result must stay hidden").count()) === 0,
      "a stale search result is not committed",
    );

    const loadMore = page.getByRole("button", { name: "Load more work" });
    await loadMore.focus();
    await page.keyboard.press("Enter");
    const retry = page.getByRole("button", { name: "Try this page again" });
    await retry.waitFor();
    check(await retry.evaluate((node) => node === document.activeElement), "failed next page restores focus to retry");
    await page.keyboard.press("Enter");
    await page.getByText("11 items").waitFor();
    check(await page.getByText("Record dogfood observations").isVisible(), "retry appends the next cursor page");
    check(expectedServiceFailures === 1, "fixture exercised exactly one recoverable HTTP 503");

    check(await page.getByText("7 items").isVisible(), "release table reports all rows");
    await page.getByRole("button", { name: "Next" }).click();
    check(
      await anyVisible(page.getByRole("link", { name: "Repository Pulse v2.0.2", exact: true })),
      "release table pages locally",
    );

    for (const width of [320, 375, 414, 768, 1024, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(overflow <= 1, `${width}px has no page-level horizontal overflow`, `${overflow}px`);
    }
    await page.setViewportSize({ width: 320, height: 900 });
    check(
      await anyVisible(page.getByText("Published", { exact: true })),
      "release rows become labelled cards at 320px",
    );
    check(runtimeErrors.length === 0, "browser produced no pageerror or console error", runtimeErrors.join(" | "));
  } finally {
    await context.close();
    await close(web);
    await close(api);
  }
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  await configurationCase(browser);
  await applicationCase(browser);
} catch (error) {
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await browser?.close();
}

console.log(`\nRepository Pulse: ${checks - failures.length}/${checks} checks passed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
