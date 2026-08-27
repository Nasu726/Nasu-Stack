/**
 * 引数を読みます。
 * **知らないフラグは黙って捨てません。** `--templat vite`のような打ち間違いを
 * 無視すると、何も言われないまま既定（astro）で作られてしまうためです。
 */
export function parseArgs(argv) {
  const args = {
    name: undefined,
    template: undefined,
    lang: undefined,
    yes: false,
    unknown: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--template" || a === "-t") args.template = argv[++i] ?? "";
    else if (a.startsWith("--template=")) args.template = a.split("=")[1];
    else if (a === "--lang" || a === "-l") args.lang = argv[++i] ?? "";
    else if (a.startsWith("--lang=")) args.lang = a.split("=")[1];
    else if (a.startsWith("-")) args.unknown.push(a);
    else args.name ??= a;
  }
  return args;
}
