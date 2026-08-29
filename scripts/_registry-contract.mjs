import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export const REGISTRY_CONTRACT_PATH = path.join("scripts", "registry-contract.json");

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const modifiersOf = (node) => ts.getModifiers(node) ?? [];
const hasModifier = (node, kind) =>
  modifiersOf(node).some((modifier) => modifier.kind === kind);

function addBindingNames(name, kind, exports) {
  if (ts.isIdentifier(name)) {
    exports.add(`${name.text}:${kind}`);
    return;
  }
  for (const element of name.elements) {
    if (!ts.isOmittedExpression(element)) addBindingNames(element.name, kind, exports);
  }
}

function declarationKind(statement) {
  if (ts.isFunctionDeclaration(statement)) return "function";
  if (ts.isClassDeclaration(statement)) return "class";
  if (ts.isInterfaceDeclaration(statement)) return "interface";
  if (ts.isTypeAliasDeclaration(statement)) return "type";
  if (ts.isEnumDeclaration(statement)) return "enum";
  if (ts.isModuleDeclaration(statement)) return "namespace";
  return null;
}

function exportedDeclarations(sourcePath) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const exports = new Set();

  for (const statement of sourceFile.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const kind = statement.isTypeOnly || element.isTypeOnly
            ? "type-re-export"
            : "re-export";
          exports.add(`${element.name.text}:${kind}`);
        }
      } else if (
        statement.exportClause &&
        ts.isNamespaceExport(statement.exportClause)
      ) {
        exports.add(`${statement.exportClause.name.text}:namespace-re-export`);
      } else {
        exports.add("*:re-export");
      }
      continue;
    }

    if (ts.isExportAssignment(statement)) {
      exports.add("default:assignment");
      continue;
    }

    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;

    if (ts.isVariableStatement(statement)) {
      const flags = statement.declarationList.flags;
      const kind = flags & ts.NodeFlags.Const
        ? "const"
        : flags & ts.NodeFlags.Let
          ? "let"
          : "var";
      for (const declaration of statement.declarationList.declarations) {
        addBindingNames(declaration.name, kind, exports);
      }
      continue;
    }

    const kind = declarationKind(statement);
    if (!kind) continue;
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      exports.add(`default:${kind}`);
    } else if (statement.name) {
      exports.add(`${statement.name.text}:${kind}`);
    }
  }

  return [...exports].sort();
}

export function buildRegistryContract(root) {
  const registry = JSON.parse(
    fs.readFileSync(path.join(root, "registry.json"), "utf8"),
  );

  return {
    version: 1,
    items: registry.items.map((item) => ({
      name: item.name,
      type: item.type,
      dependencies: item.dependencies ?? [],
      devDependencies: item.devDependencies ?? [],
      registryDependencies: item.registryDependencies ?? [],
      files: (item.files ?? []).map((file) => ({
        path: file.path,
        type: file.type,
        target: file.target ?? null,
        ...(/\.tsx?$/.test(file.path)
          ? { exports: exportedDeclarations(path.join(root, file.path)) }
          : {}),
      })),
    })),
  };
}

export function writeRegistryContract(root) {
  const contract = buildRegistryContract(root);
  const destination = path.join(root, REGISTRY_CONTRACT_PATH);
  fs.writeFileSync(destination, JSON.stringify(contract, null, 2) + "\n", "utf8");
  return contract;
}

export function checkRegistryContract(root) {
  const expectedPath = path.join(root, REGISTRY_CONTRACT_PATH);
  if (!fs.existsSync(expectedPath)) {
    return {
      problems: [`public contract: ${REGISTRY_CONTRACT_PATH} がありません`],
      itemCount: 0,
      fileCount: 0,
      exportCount: 0,
    };
  }

  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  const actual = buildRegistryContract(root);
  const problems = [];

  if (expected.version !== actual.version) {
    problems.push(
      `public contract: snapshot versionが違います（期待 ${expected.version} / 実際 ${actual.version}）`,
    );
  }

  const expectedNames = expected.items.map((item) => item.name);
  const actualNames = actual.items.map((item) => item.name);
  if (!same(expectedNames, actualNames)) {
    problems.push(
      `public contract: item名または順序が変わりました\n` +
        `    期待: ${expectedNames.join(", ")}\n    実際: ${actualNames.join(", ")}`,
    );
  }

  const actualItems = new Map(actual.items.map((item) => [item.name, item]));
  for (const expectedItem of expected.items) {
    const actualItem = actualItems.get(expectedItem.name);
    if (!actualItem) continue;

    for (const key of [
      "type",
      "dependencies",
      "devDependencies",
      "registryDependencies",
    ]) {
      if (!same(expectedItem[key], actualItem[key])) {
        problems.push(
          `public contract: ${expectedItem.name} の${key}が変わりました\n` +
            `    期待: ${JSON.stringify(expectedItem[key])}\n` +
            `    実際: ${JSON.stringify(actualItem[key])}`,
        );
      }
    }

    const fileShape = (item) =>
      item.files.map(({ path: filePath, type, target }) => ({
        path: filePath,
        type,
        target,
      }));
    if (!same(fileShape(expectedItem), fileShape(actualItem))) {
      problems.push(
        `public contract: ${expectedItem.name} の配布file / targetが変わりました\n` +
          `    期待: ${JSON.stringify(fileShape(expectedItem))}\n` +
          `    実際: ${JSON.stringify(fileShape(actualItem))}`,
      );
      continue;
    }

    for (let index = 0; index < expectedItem.files.length; index++) {
      const expectedFile = expectedItem.files[index];
      const actualFile = actualItem.files[index];
      if (!same(expectedFile.exports ?? [], actualFile.exports ?? [])) {
        problems.push(
          `public contract: ${expectedFile.path} のexportが変わりました\n` +
            `    期待: ${JSON.stringify(expectedFile.exports ?? [])}\n` +
            `    実際: ${JSON.stringify(actualFile.exports ?? [])}`,
        );
      }
    }
  }

  return {
    problems,
    itemCount: actual.items.length,
    fileCount: actual.items.reduce((count, item) => count + item.files.length, 0),
    exportCount: actual.items.reduce(
      (count, item) =>
        count +
        item.files.reduce(
          (fileCount, file) => fileCount + (file.exports?.length ?? 0),
          0,
        ),
      0,
    ),
  };
}
