// 설치된 production 의존성을 npm Bulk Advisory API로 검사해 high 이상 취약점에서 출시를 중단한다.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dirIndex = process.argv.indexOf("--dir");
const targetDir = resolve(process.cwd(), dirIndex >= 0 ? process.argv[dirIndex + 1] : ".");
const usesPnpm = existsSync(resolve(targetDir, "pnpm-lock.yaml"));
const usesNpm = existsSync(resolve(targetDir, "package-lock.json"));
const buildOnlyWaivers = {
  "image-size": {
    versions: new Set(["1.2.1"]),
    advisoryUrls: new Set([
      "https://github.com/advisories/GHSA-w3rx-r6r6-pgpr",
      "https://github.com/advisories/GHSA-5p2g-fcmc-qvqq"
    ]),
    requiredParent: "metro",
    reviewBy: "2026-09-08"
  }
};

if (!usesPnpm && !usesNpm) {
  throw new Error(`지원하는 lockfile이 없습니다: ${targetDir}`);
}

const command = usesPnpm ? "pnpm" : "npm";
const commandArgs = usesPnpm
  ? [...(existsSync(resolve(targetDir, "pnpm-workspace.yaml")) ? ["-r"] : []), "list", "--prod", "--parseable", "--depth", "Infinity"]
  : ["ls", "--omit=dev", "--all", "--parseable"];
const listed = spawnSync(command, commandArgs, {
  cwd: targetDir,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024
});

if (!listed.stdout.trim()) {
  throw new Error(`의존성 목록을 읽지 못했습니다: ${listed.stderr.trim() || `exit ${listed.status}`}`);
}

const packages = new Map();
const projectPackageFiles = [];
for (const packageDir of new Set(listed.stdout.split(/\r?\n/).filter(Boolean))) {
  const packageFile = resolve(packageDir, "package.json");
  if (!existsSync(packageFile)) continue;
  const metadata = JSON.parse(readFileSync(packageFile, "utf8"));
  if (typeof metadata.name !== "string" || typeof metadata.version !== "string") continue;
  if (!packageDir.split(/[\\/]/).includes("node_modules")) {
    projectPackageFiles.push({ metadata });
  }
  if (!packages.has(metadata.name)) packages.set(metadata.name, new Set());
  packages.get(metadata.name).add(metadata.version);
}

function hasDirectDependency(packageName) {
  const fields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  return projectPackageFiles.some(({ metadata }) =>
    fields.some((field) => metadata[field] && Object.hasOwn(metadata[field], packageName))
  );
}

function proveBuildOnlyDependency(packageName, requiredParent) {
  if (hasDirectDependency(packageName)) {
    return { valid: false, reason: "first-party package.json의 직접 의존성입니다" };
  }

  const proofArgs = usesPnpm
    ? ["-r", "why", packageName, "--json"]
    : ["explain", packageName, "--json"];
  const proof = spawnSync(command, proofArgs, {
    cwd: targetDir,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024
  });
  if (proof.status !== 0 || !proof.stdout.trim()) {
    return { valid: false, reason: `의존 경로를 증명하지 못했습니다: ${proof.stderr.trim() || `exit ${proof.status}`}` };
  }

  let dependencyTree;
  try {
    dependencyTree = JSON.parse(proof.stdout);
  } catch {
    return { valid: false, reason: "의존 경로 JSON을 해석하지 못했습니다" };
  }

  if (usesNpm) {
    const matches = Array.isArray(dependencyTree) ? dependencyTree : [dependencyTree];
    const directParents = matches.flatMap((match) =>
      Array.isArray(match?.dependents) ? match.dependents.map((dependent) => dependent?.from?.name) : []
    );
    const valid = directParents.length > 0 && directParents.every((name) => name === requiredParent);
    return {
      valid,
      reason: valid
        ? `모든 설치 경로의 직접 상위가 ${requiredParent}입니다`
        : `직접 상위가 ${requiredParent}만이 아닙니다: ${[...new Set(directParents)].filter(Boolean).join(", ") || "없음"}`
    };
  }

  const parents = [];
  function walk(node, parentName = null, dependencyName = null) {
    if (Array.isArray(node)) {
      node.forEach((value) => walk(value, parentName, dependencyName));
      return;
    }
    if (!node || typeof node !== "object") return;

    const currentName = typeof node.name === "string" ? node.name : dependencyName;
    if (currentName === packageName) parents.push(parentName);
    for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
      if (!node[field] || typeof node[field] !== "object") continue;
      for (const [name, dependency] of Object.entries(node[field])) {
        walk(dependency, currentName, name);
      }
    }
  }
  walk(dependencyTree);

  const valid = parents.length > 0 && parents.every((name) => name === requiredParent);
  return {
    valid,
    reason: valid
      ? `모든 설치 경로의 직접 상위가 ${requiredParent}입니다`
      : `직접 상위가 ${requiredParent}만이 아닙니다: ${[...new Set(parents)].filter(Boolean).join(", ") || "없음"}`
  };
}

const requestBody = Object.fromEntries(
  [...packages.entries()].map(([name, versions]) => [name, [...versions].sort()])
);
const response = await fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk", {
  method: "POST",
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json"
  },
  body: JSON.stringify(requestBody),
  signal: AbortSignal.timeout(20_000)
});

if (!response.ok) {
  throw new Error(`npm 보안 감사 실패: ${response.status} ${response.statusText}`);
}

const advisoryMap = await response.json();
const advisories = Object.entries(advisoryMap).flatMap(([name, values]) =>
  values.map((advisory) => ({ name, ...advisory }))
);
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
advisories.sort((left, right) => (severityRank[right.severity] ?? -1) - (severityRank[left.severity] ?? -1));

const waiverProofs = new Map();
function buildOnlyWaiverFor(advisory) {
  const waiver = buildOnlyWaivers[advisory.name];
  if (!waiver || !waiver.advisoryUrls.has(advisory.url)) return null;

  const versions = packages.get(advisory.name) ?? new Set();
  if (versions.size === 0 || [...versions].some((version) => !waiver.versions.has(version))) return null;
  if (new Date(`${waiver.reviewBy}T23:59:59Z`).getTime() < Date.now()) return null;

  if (!waiverProofs.has(advisory.name)) {
    waiverProofs.set(advisory.name, proveBuildOnlyDependency(advisory.name, waiver.requiredParent));
  }
  const proof = waiverProofs.get(advisory.name);
  return proof.valid ? { ...waiver, proof } : null;
}

const buildOnlyPending = [];
const blocking = [];
for (const advisory of advisories) {
  const isHighOrCritical = (severityRank[advisory.severity] ?? -1) >= severityRank.high;
  const waiver = isHighOrCritical ? buildOnlyWaiverFor(advisory) : null;
  if (waiver) {
    buildOnlyPending.push(advisory);
    console.log(
      `[${advisory.severity}/build-only] ${advisory.name}: ${advisory.title} · ${advisory.url} · ` +
      `${waiver.proof.reason} · upstream 수정 대기, ${waiver.reviewBy} 재검토`
    );
  } else {
    console.log(`[${advisory.severity}] ${advisory.name}: ${advisory.title} · ${advisory.url}`);
    if (isHighOrCritical) blocking.push(advisory);
  }
}

console.log(
  `production audit: ${packages.size} packages · ${advisories.length} advisories · ` +
  `runtime high/critical ${blocking.length} · build-only upstream ${buildOnlyPending.length}`
);

if (blocking.length > 0) process.exitCode = 1;
