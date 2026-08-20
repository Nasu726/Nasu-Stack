/**
 * テーマの色と選択 UI の実ブラウザ検証。
 *
 * 色は CSS の字面ではなく Chromium が描画した sRGB 値から測ります。
 * OKLCH の値を手計算すると、色域外の色をブラウザが丸める過程が抜けて
 * 実際の画面と違う数字になるためです。
 */
import { launch } from "./_browser.mjs";

const { openTab, finish, must } = await launch();
const page = await openTab("layout", { width: 1100, height: 900 });

const contrastResults = await page.evaluate(() => {
  const themes = ["neutral", "warm", "editorial", "vivid"];
  const modes = ["light", "dark"];
  const pairs = [
    ["fg/bg", "--fg", "--bg", 4.5],
    ["card-fg/card", "--card-fg", "--card", 4.5],
    ["muted-fg/bg", "--muted-fg", "--bg", 4.5],
    ["muted-fg/card", "--muted-fg", "--card", 4.5],
    ["primary-fg/primary", "--primary-fg", "--primary", 4.5],
    ["danger-fg/danger", "--danger-fg", "--danger", 4.5],
    ["success-fg/success", "--success-fg", "--success", 4.5],
    ["warning-fg/warning", "--warning-fg", "--warning", 4.5],
    // これらの semantic token は背景だけでなく、リンク・エラー文・
    // 成功メッセージの文字色として公開部品が直接使っています。
    ["primary/card", "--primary", "--card", 4.5],
    ["danger/card", "--danger", "--card", 4.5],
    ["success/card", "--success", "--card", 4.5],
  ];

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const toSrgb = (cssColor) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = cssColor;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  };
  const luminance = (rgb) => {
    const linear = rgb.map((byte) => {
      const value = byte / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const ratio = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };

  const results = [];
  for (const theme of themes) {
    for (const mode of modes) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", mode === "dark");
      const style = getComputedStyle(document.documentElement);
      for (const [name, foreground, background, minimum] of pairs) {
        const fg = toSrgb(style.getPropertyValue(foreground).trim());
        const bg = toSrgb(style.getPropertyValue(background).trim());
        results.push({ theme, mode, name, ratio: ratio(fg, bg), minimum, fg, bg });
      }
    }
  }
  // 上の測定は html を直接切り替えるため、React が持つ初期値へ戻してから
  // ThemeSwitcher 自身の操作を検査します。
  document.documentElement.dataset.theme = "neutral";
  document.documentElement.classList.remove("dark");
  return results;
});

for (const result of contrastResults) {
  must(
    `${result.theme}/${result.mode}: ${result.name} のコントラスト`,
    result.ratio >= result.minimum,
    `${result.ratio.toFixed(3)}:1 / 必要 ${result.minimum}:1 (rgb ${result.fg.join(",")} / ${result.bg.join(",")})`,
  );
}

// ThemeSwitcher は見た目を再実装せず、ブラウザ標準のラジオ操作を使います。
const radios = page.getByRole("radio");
const radioCount = await radios.count();
must("テーマ選択は native radio 4 個である", radioCount === 4, `${radioCount} 個`);

if (radioCount === 4) {
  const native = await radios.evaluateAll((items) =>
    items.map((item) => ({
      tag: item.tagName,
      type: item instanceof HTMLInputElement ? item.type : "",
      name: item instanceof HTMLInputElement ? item.name : "",
    })),
  );
  must(
    "テーマ選択を input[type=radio] に委ねている",
    native.every((item) => item.tag === "INPUT" && item.type === "radio"),
    JSON.stringify(native),
  );
  must(
    "4 個のテーマ選択が同じ radio group に属する",
    new Set(native.map((item) => item.name).filter(Boolean)).size === 1,
    native.map((item) => item.name || "(名前なし)").join(" / "),
  );

  const checked = page.locator('input[type="radio"]:checked');
  must("現在のテーマだけが選択済みになる", (await checked.count()) === 1);

  await page.getByRole("radio", { name: "Neutral" }).focus();
  await page.keyboard.press("ArrowRight");
  must(
    "右矢印で次のテーマへ移る",
    await page.getByRole("radio", { name: "Warm" }).isChecked(),
  );
  await page.waitForFunction(
    () => document.documentElement.dataset.theme === "warm",
  );
  must(
    "キーボード選択が実際のテーマへ反映される",
    (await page.locator("html").getAttribute("data-theme")) === "warm",
  );

  await page.getByRole("radio", { name: "Vivid" }).focus();
  await page.keyboard.press("ArrowRight");
  must(
    "右矢印で末尾から先頭へ循環する",
    await page.getByRole("radio", { name: "Neutral" }).isChecked(),
  );
  await page.keyboard.press("ArrowLeft");
  must(
    "左矢印で前のテーマへ移り、先頭から末尾へ循環する",
    await page.getByRole("radio", { name: "Vivid" }).isChecked(),
  );
}

await finish();
