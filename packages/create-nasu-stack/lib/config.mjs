import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const TEMPLATES = path.join(PACKAGE_ROOT, "template");

export const MIN_NODE = "22.12.0";

const cmp = (a, b) => {
  const pa = String(a).replace(/^v/, "").split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
};

export const LANGUAGES = new Set(["en", "ja"]);

export const UI = {
  en: {
    banner: "Nasu Stack — Start with a working project",
    projectName: "Project name:",
    missingName: "Specify a project name",
    missingNameHint: "Add the name you want to the end of the command you just ran",
    unknownOption: "Unknown option",
    availableOptions: "Available options: --template <kind> / --lang <en|ja> / --yes / --help",
    kinds: "Kinds",
    unknownTemplate: "Unknown template",
    availableKinds: "Available kinds",
    invalidLanguage: "Unknown language. Use en or ja",
    invalidChoice: (length) => `Please enter a number from 1 to ${length}.`,
    startTitle: "How would you like to start?",
    startQuestion: "Choose a starting point",
    scratchTitle: "What would you like to build?",
    templateTitle: "Choose a template",
    scratchQuestion: "Choose a project type",
    templateQuestion: "Choose a template",
    created: (name, label) => `Created ${name} (${label})`,
    guide: (name) => `The usage guide is in ${name}/HowToUse.md.`,
    guideHint: "It covers what to edit, how to add components, and how to deploy.",
  },
  ja: {
    banner: "Nasu Stack — 動くところから始めます",
    projectName: "プロジェクト名:",
    missingName: "プロジェクト名を指定してください",
    missingNameHint: "さっき打ったコマンドの最後に、作りたい名前を足してください",
    unknownOption: "知らない指定です",
    availableOptions: "使えるのは --template <種類> / --lang <en|ja> / --yes / --help です",
    kinds: "種類",
    unknownTemplate: "知らないテンプレートです",
    availableKinds: "使える種類",
    invalidLanguage: "知らない言語です。en または ja を指定してください",
    invalidChoice: (length) => `1 から ${length} の数字を入力してください。`,
    startTitle: "どのように始めますか？",
    startQuestion: "始め方を選んでください",
    scratchTitle: "何を作りますか？",
    templateTitle: "雛型を選んでください",
    scratchQuestion: "種類を選んでください",
    templateQuestion: "雛型を選んでください",
    created: (name, label) => `${name} を作りました（${label}）`,
    guide: (name) => `使い方は ${name}/HowToUse.md に書きました。`,
    guideHint: "どのファイルを触るか、部品の足し方、公開のしかたまで入っています。",
  },
};

export const ui = (lang) => UI[LANGUAGES.has(lang) ? lang : "en"];

/** 足りなければ理由と直し方を出して止めます。 */
export function checkNodeVersion(current = process.version, lang = "en") {
  if (cmp(current, MIN_NODE) >= 0) return null;
  if (lang === "ja") {
    return [
      `Node.js が古いため、作ったものが動きません。`,
      ``,
      `  いま: ${current}`,
      `  必要: v${MIN_NODE} 以上`,
      ``,
      `  https://nodejs.org/ から新しいものを入れてください。`,
      `  nvm を使っているなら: nvm install ${MIN_NODE} && nvm use ${MIN_NODE}`,
    ].join("\n");
  }
  return [
    `Your Node.js version is too old for the generated project.`,
    ``,
    `  Current:  ${current}`,
    `  Required: v${MIN_NODE} or newer`,
    ``,
    `  Install a newer version from https://nodejs.org/.`,
    `  If you use nvm: nvm install ${MIN_NODE} && nvm use ${MIN_NODE}`,
  ].join("\n");
}

/** CLIで選べる生成物。質問、help、生成後の表示が同じ一覧を参照します。 */
export const KINDS = [
  {
    key: "astro",
    mode: "scratch",
    label: { en: "Website (Astro)", ja: "サイト（Astro）" },
    hint: {
      en: "One page. Build the rest yourself.",
      ja: "1 ページだけ。自分で組み立てたい人向け。",
    },
  },
  {
    key: "blog",
    mode: "template",
    label: { en: "Blog / multipage site (Astro)", ja: "ブログ・複数ページのサイト（Astro）" },
    hint: {
      en: "Blog, landing page, about, contact, RSS, sitemap, and 404 included.",
      ja: "ブログ・LP・会社概要・問い合わせ・RSS・sitemap・404 入り。",
    },
  },
  {
    key: "repository-pulse",
    mode: "template",
    label: { en: "Repository Pulse (Vite + React)", ja: "Repository Pulse（Vite + React）" },
    hint: {
      en: "A complete public GitHub repository dashboard with search, pagination, and tests.",
      ja: "公開GitHub repositoryの概要・検索・追加読込・検査が入った実アプリ。",
    },
  },
  {
    key: "weather-planner",
    mode: "template",
    label: { en: "Weather Planner (Vite + React)", ja: "Weather Planner（Vite + React）" },
    hint: {
      en: "A seven-day planner with place search, local autosave, and fixture-driven tests.",
      ja: "場所検索・local autosave・固定fixture検査が入った7日分の予定アプリ。",
    },
  },
  {
    key: "vite",
    mode: "scratch",
    label: { en: "App (Vite + React)", ja: "アプリ（Vite + React）" },
    hint: {
      en: "For dashboards, tools, and other highly interactive screens.",
      ja: "管理画面やツールなど、画面内で動く部分が多いもの向け。",
    },
  },
];

export const START_MODES = [
  {
    key: "scratch",
    label: { en: "From scratch", ja: "まっさらな状態から" },
    hint: {
      en: "Start small and assemble the project yourself.",
      ja: "最小構成から自分で組み立てます。",
    },
  },
  {
    key: "template",
    label: { en: "Use a template", ja: "雛型を使う" },
    hint: {
      en: "Start with common pages and features already included.",
      ja: "よく使うページと機能が入った状態から始めます。",
    },
  },
];

export const LANGUAGE_OPTIONS = [
  { key: "en", label: "English", hint: "Continue in English." },
  { key: "ja", label: "日本語", hint: "日本語で続けます。" },
];

export const localized = (items, lang) =>
  items.map((item) => ({
    ...item,
    label: typeof item.label === "string" ? item.label : item.label[lang],
    hint: typeof item.hint === "string" ? item.hint : item.hint[lang],
  }));

export const kindLabel = (kind, lang) =>
  KINDS.find((item) => item.key === kind)?.label[lang] ?? kind;

/** Astro の雛型か。Vite製の完成雛型が増えても、名前から推測しません。 */
export const isAstro = (kind) => kind === "astro" || kind === "blog";
