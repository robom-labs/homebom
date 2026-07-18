// 청약봄에 저장된 패밀리 생성물의 파일 목록·해시·immutable 정본 SHA를 검증한다.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const PINNED_SOURCE_COMMIT = "009905aeb250a77c0bae2518c589f3d861e54450";
const REQUIRED_FILES = [
  "analytics-events.ts",
  "app-meta.json",
  "auth-config.json",
  "feature-flags.json",
  "icons.svg",
  "settings-contract.json",
  "tokens.css",
  "wordmark.svg",
].sort();
const generatedDir = resolve(process.argv[2] || "");
const lockFile = resolve(process.argv[3] || "");

if (!process.argv[2] || !process.argv[3]) {
  throw new Error("사용법: verify-family.mjs <generated-dir> <family-lock>");
}

const lock = JSON.parse(await readFile(lockFile, "utf8"));
if (lock.sourceCommit !== PINNED_SOURCE_COMMIT) {
  throw new Error("family.lock.json sourceCommit이 고정 정본 SHA와 다릅니다.");
}
if (lock.familySpecVersion !== "1.0.0") {
  throw new Error("지원하지 않는 패밀리 규격입니다: " + lock.familySpecVersion);
}

const expectedFiles = Object.keys(lock.files || {}).sort();
if (JSON.stringify(expectedFiles) !== JSON.stringify(REQUIRED_FILES)) {
  throw new Error("패밀리 필수 생성물 8개가 family.lock.json에 모두 포함되지 않았습니다.");
}
const actualFiles = (await readdir(generatedDir, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error("패밀리 생성물 파일 목록이 family.lock.json과 다릅니다.");
}

for (const name of expectedFiles) {
  const content = await readFile(resolve(generatedDir, name));
  const actual = "sha256:" + createHash("sha256").update(content).digest("hex");
  if (actual !== lock.files[name]) {
    throw new Error(name + " 해시가 family.lock.json과 다릅니다.");
  }
}

const repoRoot = dirname(lockFile);
const [appMeta, featureFlags, authConfig, packageInfo] = await Promise.all([
  readFile(resolve(generatedDir, "app-meta.json"), "utf8").then(JSON.parse),
  readFile(resolve(generatedDir, "feature-flags.json"), "utf8").then(JSON.parse),
  readFile(resolve(generatedDir, "auth-config.json"), "utf8").then(JSON.parse),
  readFile(resolve(repoRoot, "apps/web/package.json"), "utf8").then(JSON.parse),
]);

if (appMeta.id !== "homebom" || appMeta.version !== packageInfo.version) {
  throw new Error(`중앙 registry app-meta drift: app-meta=${appMeta.version ?? "없음"}, package=${packageInfo.version ?? "없음"}`);
}
if (appMeta.familyApps?.length !== 5) {
  throw new Error("app-meta.json에 패밀리 앱 5개가 모두 포함되지 않았습니다.");
}
if (featureFlags.ads?.enabled !== false || featureFlags.analytics?.enabled !== false) {
  throw new Error("feature-flags.json의 광고·분석 기본값은 비활성이어야 합니다.");
}
if (authConfig.guestFirst !== true || authConfig.namespace !== "homebom" || authConfig.issuer !== "") {
  throw new Error("auth-config.json이 HomeBom guest-first 미설정 공급자 계약과 다릅니다.");
}

console.log(`패밀리 생성물 8개·app-meta drift 0 검증 통과: ${PINNED_SOURCE_COMMIT}`);
