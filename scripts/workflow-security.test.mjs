// 모든 GitHub Actions 참조가 변하지 않는 40자리 커밋으로 고정됐는지 검사한다.
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowsDir = path.join(root, ".github", "workflows");

test("모든 외부 GitHub Action은 40자리 커밋 SHA로 고정한다", async () => {
  const files = (await readdir(workflowsDir)).filter((name) => /\.ya?ml$/.test(name));
  const unpinned = [];

  for (const file of files) {
    const lines = (await readFile(path.join(workflowsDir, file), "utf8")).split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/uses:\s+([^\s#]+)/);
      if (!match || match[1].startsWith("./")) return;
      const reference = match[1].slice(match[1].lastIndexOf("@") + 1);
      if (!/^[0-9a-f]{40}$/.test(reference)) {
        unpinned.push(`${file}:${index + 1} ${match[1]}`);
      }
    });
  }

  assert.deepEqual(unpinned, []);
});
