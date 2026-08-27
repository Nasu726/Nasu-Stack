import {
  KINDS,
  LANGUAGE_OPTIONS,
  START_MODES,
  localized,
  ui,
} from "./config.mjs";

async function askChoice(rl, { title, options, question, lang }, write) {
  write("");
  write(`  ${title}`);
  write("");
  options.forEach((option, index) => {
    write(`    ${index + 1}. ${option.label}: ${option.hint}`);
  });
  write("");

  while (true) {
    const answer = (await rl.question(`  ${question} [1] `)).trim();
    const selected = options[Number(answer || "1") - 1];
    if (selected) return selected;
    write(`  ${lang ? ui(lang).invalidChoice(options.length) :
      `Please enter 1-${options.length}. / 1 から ${options.length} の数字を入力してください。`}`);
  }
}

/** 最初の問いだけは、まだ言語が決まっていないので両言語で出します。 */
export async function chooseLanguage(rl, write = console.log) {
  const language = await askChoice(
    rl,
    {
      title: "Language / 言語",
      options: LANGUAGE_OPTIONS,
      question: "Choose a language / 言語を選んでください",
      lang: null,
    },
    write,
  );
  return language.key;
}

/**
 * 対話は「始め方」から「具体的な種類」へ進めます。
 * 選択肢を1行に収め、名前と説明の対応が目で追える形にします。
 */
export async function chooseInteractiveKind(rl, lang = "en", write = console.log) {
  const copy = ui(lang);
  const mode = await askChoice(
    rl,
    {
      title: copy.startTitle,
      options: localized(START_MODES, lang),
      question: copy.startQuestion,
      lang,
    },
    write,
  );
  const kind = await askChoice(
    rl,
    {
      title: mode.key === "scratch" ? copy.scratchTitle : copy.templateTitle,
      options: localized(KINDS.filter((item) => item.mode === mode.key), lang),
      question: mode.key === "scratch" ? copy.scratchQuestion : copy.templateQuestion,
      lang,
    },
    write,
  );
  return kind.key;
}
