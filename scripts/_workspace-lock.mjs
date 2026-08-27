import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sleepBuffer = new Int32Array(new SharedArrayBuffer(4));
const OWNER_WRITE_GRACE_MS = 5_000;

function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} は0以上の有限値にしてください`);
  }
}

function validateName(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new TypeError(`lock名が不正です: ${name}`);
  }
}

/** 同じworkspaceだけが共有する、system temp内のlock directoryです。 */
export function workspaceLockPath(name, root) {
  validateName(name);
  const resolved = path.resolve(root);
  const identity = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const hash = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), `nasu-stack-${hash}-${name}.lock`);
}

function readOwner(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockPath, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERMなら存在はしています。ESRCH / EINVAL等は有効なownerではありません。
    return error?.code === "EPERM";
  }
}

function mayRemoveStaleLock(lockPath, staleMs) {
  const owner = readOwner(lockPath);
  if (owner) return !processIsAlive(owner.pid);

  /* mkdir成功からowner.json作成までにkillされた場合だけの回収です。
     正常なwriterは同期的に直後へ書くため5秒あれば十分です。一方、作成途中の
     directoryを即座に奪うと、遅いfilesystem上で生きたownerと競合します。 */
  try {
    return Date.now() - fs.statSync(lockPath).mtimeMs >= Math.min(staleMs, OWNER_WRITE_GRACE_MS);
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

function removeStaleLock(lockPath) {
  /* check後に別processが同じpathを取り直すraceを避けます。先に原子的に
     別名へ移し、移せたprocessだけが古いdirectoryを消します。 */
  const claimed = `${lockPath}.stale-${randomUUID()}`;
  try {
    fs.renameSync(lockPath, claimed);
    fs.rmSync(claimed, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

/**
 * workspace内の生成物を複数processが同時に書き換えないための同期lockです。
 * mkdirの原子性だけを使うため、Windows / Linuxの両方で同じ契約になります。
 */
export function acquireWorkspaceLockSync(
  name,
  {
    root,
    timeoutMs = 30 * 60 * 1000,
    staleMs = 60 * 60 * 1000,
    pollMs = 200,
    onWait = () => {},
  },
) {
  if (!root) throw new TypeError("lockのrootを指定してください");
  finiteNonNegative(timeoutMs, "timeoutMs");
  finiteNonNegative(staleMs, "staleMs");
  finiteNonNegative(pollMs, "pollMs");

  const lockPath = workspaceLockPath(name, root);
  const token = randomUUID();
  const startedAt = Date.now();
  let announced = false;

  for (;;) {
    let created = false;
    try {
      fs.mkdirSync(lockPath);
      created = true;
      fs.writeFileSync(
        path.join(lockPath, "owner.json"),
        `${JSON.stringify({ token, pid: process.pid, startedAt: new Date().toISOString() })}\n`,
        "utf8",
      );
      break;
    } catch (error) {
      if (created) {
        fs.rmSync(lockPath, { recursive: true, force: true });
      }
      if (error?.code !== "EEXIST") throw error;

      if (mayRemoveStaleLock(lockPath, staleMs)) {
        removeStaleLock(lockPath);
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        const owner = readOwner(lockPath);
        throw new Error(
          `${name} lockを${timeoutMs}ms以内に取得できませんでした` +
            (owner?.pid ? ` (owner pid ${owner.pid})` : ""),
        );
      }
      if (!announced) {
        announced = true;
        onWait(readOwner(lockPath));
      }
      Atomics.wait(sleepBuffer, 0, 0, pollMs);
    }
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    process.removeListener("exit", release);
    const owner = readOwner(lockPath);
    // stale回収後に別processが取り直していたら、そのlockは消しません。
    if (owner?.token === token) {
      fs.rmSync(lockPath, { recursive: true, force: true });
    }
  };
  process.once("exit", release);
  return release;
}
