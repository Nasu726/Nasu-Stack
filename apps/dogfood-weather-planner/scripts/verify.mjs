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
  const failure = detail ? `${message}: ${detail}` : message;
  failures.push(failure);
  console.error(`  ✗ ${message}${detail ? ` — ${detail}` : ""}`);
}

function buildWith(values) {
  const command = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npm";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npm run build"] : ["run", "build"];
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("npm_config_")),
  );
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...environment, ...values },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`build failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function staticServer() {
  const dist = path.join(root, "dist");
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.resolve(dist, relative);
    if (!file.startsWith(`${dist}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }
    const extension = path.extname(file);
    const type = extension === ".js"
      ? "text/javascript; charset=utf-8"
      : extension === ".css"
        ? "text/css; charset=utf-8"
        : "text/html; charset=utf-8";
    response.writeHead(200, { "content-type": type });
    fs.createReadStream(file).pipe(response);
  });
}

async function configurationCase(browser) {
  buildWith({
    VITE_DEFAULT_LATITUDE: "north",
    VITE_WEATHER_API_URL: "https://api.open-meteo.com/",
    VITE_GEOCODING_API_URL: "https://geocoding-api.open-meteo.com/",
  });
  const web = staticServer();
  await listen(web, 4210);
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  page.on("request", (request) => {
    if (request.url().includes("open-meteo")) requests.push(request.url());
  });
  try {
    await page.goto("http://127.0.0.1:4210/");
    check(
      await page.getByRole("heading", { name: "Weather Planner could not start" }).isVisible(),
      "invalid public configuration has an explicit startup screen",
    );
    check(
      await page.getByText(/VITE_DEFAULT_LATITUDE must be a number/).isVisible(),
      "configuration error names the exact variable and correction",
    );
    check(requests.length === 0, "invalid configuration makes no external request");
  } finally {
    await context.close();
    await close(web);
  }
}

async function selectLocation(page, query, label) {
  const input = page.getByRole("combobox", { name: "Location" });
  await input.click();
  await input.fill(query);
  await page.getByRole("option", { name: new RegExp(label) }).waitFor();
  await input.press("ArrowDown");
  await input.press("Enter");
}

async function applicationCase(browser) {
  const fixtureUrl = "http://127.0.0.1:5209/";
  buildWith({
    VITE_WEATHER_API_URL: fixtureUrl,
    VITE_GEOCODING_API_URL: fixtureUrl,
    VITE_DEFAULT_LATITUDE: "35.6762",
    VITE_DEFAULT_LONGITUDE: "139.6503",
    VITE_DEFAULT_LOCATION: "Tokyo",
    VITE_DEFAULT_COUNTRY: "Japan",
    VITE_DEFAULT_LOCALE: "en",
  });
  const api = createFixtureApi();
  const web = staticServer();
  await listen(api, 5209);
  await listen(web, 4211);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const runtimeErrors = [];
  const httpFailures = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // Chromium reports expected HTTP 503 responses as a generic console error.
    // The exact failed URLs/statuses are checked separately below, so do not
    // count the same event twice without its URL.
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      httpFailures.push({ status: response.status(), url: response.url() });
    }
  });

  try {
    await page.goto("http://127.0.0.1:4211/");
    await page.locator("[data-forecast-date]").first().waitFor();
    check(await page.locator("[data-forecast-date]").count() === 7, "seven forecast days render");
    check(
      (await page.locator("html").getAttribute("data-theme")) === "vivid",
      "the app tone is fixed in code without a visitor theme picker",
    );
    check(
      await page.getByRole("link", { name: "Weather data by Open-Meteo.com" }).isVisible(),
      "weather attribution is visible next to the forecast",
    );
    check(
      !(await page.getByRole("button", { name: /theme|tone/i }).isVisible().catch(() => false)),
      "no theme switcher is rendered",
    );

    const details = page.getByRole("button", { name: "Forecast details" }).first();
    await details.focus();
    await details.press("Enter");
    check(await page.getByText("Wind", { exact: true }).first().isVisible(), "forecast popover opens by keyboard");
    await page.keyboard.press("Escape");
    check(await details.evaluate((node) => node === document.activeElement), "Escape restores focus to the popover trigger");

    const locationInput = page.getByRole("combobox", { name: "Location" });
    await locationInput.click();
    await locationInput.fill("slow");
    await page.waitForTimeout(350);
    await locationInput.fill("syd");
    await page.getByRole("option", { name: /Sydney/ }).waitFor();
    await page.waitForTimeout(650);
    check(
      !(await page.getByText("Stale Slow Place", { exact: true }).isVisible().catch(() => false)),
      "a late location response cannot replace the latest query",
    );
    await locationInput.press("ArrowDown");
    await locationInput.press("Enter");
    await page.getByRole("heading", { name: /Sydney, New South Wales, Australia/ }).waitFor();
    await page.locator('[data-weather-code="4"]').waitFor();
    check(true, "keyboard selection changes the forecast and discards the old request");

    const firstCard = page.locator("[data-forecast-date]").first();
    await firstCard.getByRole("radio", { name: "Outdoor time" }).check();
    const note = firstCard.getByRole("textbox", { name: /Plan note for/ });
    await note.fill("Picnic");
    await note.fill("Picnic after four");
    await page.locator('[data-save-status="saved"]').waitFor({ timeout: 5000 });
    const stored = await page.evaluate(() => localStorage.getItem("nasu-stack.weather-planner.v1"));
    check(stored?.includes("Picnic after four"), "autosave stores only the latest queued note");
    check(!stored?.includes('"note":"Picnic"'), "an intermediate queued note is not the final draft");
    check((await page.locator("[data-planned-count]").textContent())?.trim() === "1", "planned-day summary updates");

    await page.reload();
    await page.locator("[data-forecast-date]").first().waitFor();
    check(
      (await page.getByRole("textbox", { name: /Plan note for/ }).first().inputValue()) === "Picnic after four",
      "a saved draft is restored after reload",
    );
    check(
      await page.getByText("A previous plan was restored from this browser.").isVisible(),
      "restore status explains the browser-local boundary",
    );

    await page.evaluate(() => {
      const storage = Storage.prototype;
      const original = storage.setItem;
      Object.defineProperty(window, "__restoreSetItem", { value: () => { storage.setItem = original; } });
      storage.setItem = () => { throw new DOMException("fixture quota", "QuotaExceededError"); };
    });
    await page.getByRole("textbox", { name: /Plan note for/ }).first().fill("Save should fail once");
    await page.locator('[data-save-status="error"]').waitFor({ timeout: 5000 });
    check(
      await page.getByText(/could not save your plan/i).isVisible(),
      "local storage failure stays visible and actionable",
    );
    await page.evaluate(() => window.__restoreSetItem());
    await page.getByRole("button", { name: "Try saving again" }).click();
    await page.locator('[data-save-status="saved"]').waitFor({ timeout: 5000 });
    check(true, "a failed autosave retries the same latest draft");

    await page.getByRole("button", { name: "Plan options" }).click();
    await page.getByRole("button", { name: "Clear this week" }).click();
    await page.locator('[data-save-status="saved"]').waitFor({ timeout: 5000 });
    check((await page.locator("[data-planned-count]").textContent())?.trim() === "0", "plan options clear the week");

    await fetch(`${fixtureUrl}__control/forecast?mode=error`);
    await selectLocation(page, "broken", "Broken Bay");
    await page.getByRole("button", { name: "Try the forecast again" }).waitFor({ timeout: 6000 });
    check(
      await page.getByText(/weather service could not complete this request/i).isVisible(),
      "forecast failure has a retryable safe message",
    );
    check(
      !(await page.getByText(/fixture details|fixture server text/i).isVisible().catch(() => false)),
      "untrusted server text is not displayed",
    );
    check(
      httpFailures.length === 2 &&
        httpFailures.every(
          (failure) =>
            failure.status === 503 && failure.url.startsWith(`${fixtureUrl}v1/forecast?`),
        ),
      "only the two intentional forecast attempts fail over HTTP",
      JSON.stringify(httpFailures),
    );
    await fetch(`${fixtureUrl}__control/forecast?mode=ok`);
    await page.getByRole("button", { name: "Try the forecast again" }).click();
    await page.locator("[data-forecast-date]").first().waitFor();
    check(await page.locator("[data-forecast-date]").count() === 7, "manual retry recovers the forecast");

    await locationInput.click();
    await locationInput.fill("malformed");
    await page.getByText(/returned data this app does not understand/i).waitFor();
    check(true, "malformed location data fails closed in the selector");
    await locationInput.press("Escape");

    for (const width of [320, 375, 414, 768, 1024, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      );
      check(overflow <= 1, `${width}px has no page-level horizontal overflow`, `${overflow}px`);
    }
    await page.setViewportSize({ width: 1024, height: 900 });
    const hintMeasure = await page
      .getByText("Type at least two characters. Choosing a new place starts a new local plan.")
      .evaluate((element) => {
        const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
        return element.getBoundingClientRect().width / fontSize;
      });
    check(
      hintMeasure <= 40,
      "the location hint stays within a readable line length",
      `${hintMeasure.toFixed(1)}em`,
    );
    await page.setViewportSize({ width: 320, height: 640 });
    await page.getByRole("button", { name: "Forecast details" }).last().scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: "Forecast details" }).last().click();
    const popoverBox = await page.getByText("Timezone", { exact: true }).last().locator("..",).boundingBox();
    check(
      Boolean(popoverBox && popoverBox.x >= 0 && popoverBox.x + popoverBox.width <= 320 && popoverBox.y >= 0 && popoverBox.y + popoverBox.height <= 640),
      "the last forecast popover remains inside a 320px viewport",
      JSON.stringify(popoverBox),
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
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  await configurationCase(browser);
  await applicationCase(browser);
} catch (error) {
  failures.push(error instanceof Error ? error.stack ?? error.message : String(error));
} finally {
  await browser?.close();
}

console.log(`\nWeather Planner: ${checks - failures.length}/${checks} checks passed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
}
