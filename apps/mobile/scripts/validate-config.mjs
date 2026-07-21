// Expo SDK 57 네이티브 설정과 핵심 안전 계약을 정적으로 검증한다.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(projectRoot, relativePath), "utf8"));
}

async function collectSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSources(path);
    return /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : [];
  }));
  return nested.flat();
}

const [appConfig, easConfig, packageJson, rootPackageJson] = await Promise.all([
  readJson("app.json"),
  readJson("eas.json"),
  readJson("package.json"),
  readJson("../../package.json"),
]);

const expo = appConfig.expo;
assert(packageJson.dependencies.expo.startsWith("~57.0."), "expo는 SDK 57 버전이어야 합니다.");
assert(packageJson.dependencies["expo-notifications"].startsWith("~57.0."), "expo-notifications는 SDK 57 호환 버전이어야 합니다.");
assert(!packageJson.dependencies["react-native-webview"], "WebView 의존성을 사용할 수 없습니다.");
assert(expo.scheme === "homebom", "scheme은 homebom이어야 합니다.");
assert(expo.android.package === "kr.robom.homebom", "Android package가 일치하지 않습니다.");
assert(expo.ios.bundleIdentifier === "kr.robom.homebom", "iOS bundleIdentifier가 일치하지 않습니다.");
assert(expo.ios.associatedDomains.includes("applinks:robom.kr"), "iOS Universal Link 도메인이 필요합니다.");
assert(expo.icon === "./assets/icon.png", "스토어용 앱 아이콘 경로가 필요합니다.");
assert(expo.android.intentFilters.some((filter) => filter.data?.some((data) => data.scheme === "https" && data.host === "robom.kr" && data.pathPrefix === "/get/homebom")), "Android App Link 경로가 필요합니다.");
assert(expo.version === packageJson.version && packageJson.version === rootPackageJson.version, "루트·네이티브 앱 버전이 일치해야 합니다.");
assert(expo.orientation === "default", "휴대폰·태블릿 회전을 모두 지원해야 합니다.");
assert(expo.ios.supportsTablet === true, "iPad 지원이 켜져 있어야 합니다.");
assert(typeof expo.description === "string" && expo.description.length >= 20, "스토어 설명이 필요합니다.");
assert(expo.platforms.length === 2 && expo.platforms.includes("android") && expo.platforms.includes("ios"), "Android와 iOS만 대상으로 해야 합니다.");
assert(expo.plugins.some((plugin) => Array.isArray(plugin) && plugin[0] === "expo-notifications"), "expo-notifications config plugin이 필요합니다.");

for (const profile of ["development", "preview", "production"]) {
  assert(easConfig.build[profile], `EAS ${profile} profile이 필요합니다.`);
}
assert(easConfig.build.development.developmentClient === true, "development profile은 development client여야 합니다.");
assert(easConfig.build.development.distribution === "internal", "development profile은 internal 배포여야 합니다.");
assert(easConfig.build.preview.distribution === "internal", "preview profile은 internal 배포여야 합니다.");
assert(!easConfig.submit, "이 프로젝트에는 자동 store submit 설정을 두지 않습니다.");

const sourceFiles = [
  join(projectRoot, "App.tsx"),
  join(projectRoot, "index.ts"),
  join(projectRoot, "expo-env.d.ts"),
  ...(await collectSources(join(projectRoot, "src"))),
  ...(await collectSources(join(projectRoot, "scripts"))),
];
const forbiddenView = ["Web", "View"].join("");
for (const sourceFile of sourceFiles) {
  const source = await readFile(sourceFile, "utf8");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  assert(firstLine.startsWith("//") && /[가-힣]/.test(firstLine), `${sourceFile} 첫 줄에 한국어 역할 주석이 필요합니다.`);
  if (!sourceFile.endsWith("validate-config.mjs")) {
    assert(!source.includes(forbiddenView), `${sourceFile}에서 WebView 사용이 감지되었습니다.`);
  }
}

const storageSource = await readFile(join(projectRoot, "src/storage/interests.ts"), "utf8");
const feedSource = await readFile(join(projectRoot, "src/domain/noticesFeed.ts"), "utf8");
const appSource = await readFile(join(projectRoot, "App.tsx"), "utf8");
assert(storageSource.includes('"homebom:native:interests:v1"'), "네이티브 전용 관심 저장 키가 필요합니다.");
assert(!storageSource.includes("zzc:subs:") && !storageSource.includes("zzc:fired:"), "웹 저장 키를 네이티브 저장소에서 사용하면 안 됩니다.");
assert(feedSource.includes('"homebom:native:notices:lkg:v1"'), "네이티브 전용 마지막 확인본 저장 키가 필요합니다.");
assert(feedSource.includes("EXPO_PUBLIC_NOTICES_URL") || (await readFile(join(projectRoot, "src/hooks/useNotices.ts"), "utf8")).includes("EXPO_PUBLIC_NOTICES_URL"), "실공고 URL은 EXPO_PUBLIC_NOTICES_URL에서만 읽어야 합니다.");
assert(!appSource.includes("requestPermissionsAsync"), "App 초기화 경로에서 알림 권한을 직접 요청하면 안 됩니다.");

console.log("HomeBom mobile config validation passed.");
