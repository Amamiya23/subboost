import { readFileSync } from "node:fs";
import { sha256Hex } from "./crypto/hash";

export type AppVersionInfo = {
  version: string;
  releaseVersion: string;
  buildSha: string | null;
  buildVersion: string;
  versionToken: string;
};

export type AppVersionEnvironment = Record<string, string | undefined>;

export type ResolveAppVersionInfoOptions = {
  env: AppVersionEnvironment;
  cwd: string;
  readFile?: (filePath: string) => string;
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeReleaseVersion(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized && SEMVER_PATTERN.test(normalized) ? normalized : null;
}

function inferReleaseVersion(version: string | null): string | null {
  const match = version ? SEMVER_PATTERN.exec(version) : null;
  if (!match) return null;

  const [, major, minor, patch, prerelease] = match;
  return prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`;
}

function normalizeBuildSha(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^[0-9a-f]{7,40}$/i.test(normalized) ? normalized : null;
}

function formatBuildVersion(releaseVersion: string, buildSha: string | null): string {
  if (!buildSha) return releaseVersion;
  return `${releaseVersion}+sha.${buildSha.slice(0, 12)}`;
}

async function formatVersionToken(releaseVersion: string, buildSha: string | null, buildVersion: string): Promise<string> {
  if (!buildSha && buildVersion === releaseVersion) return buildVersion;
  const digest = (await sha256Hex(`${releaseVersion}:${buildSha ?? ""}:${buildVersion}`)).slice(0, 12);
  return `${releaseVersion}+build.${digest}`;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function joinPackagePath(cwd: string, segments: string[]): string {
  const separator = cwd.includes("\\") && !cwd.includes("/") ? "\\" : "/";
  const prefix = cwd.startsWith(separator) ? separator : "";
  const normalized: string[] = [];

  for (const segment of [...cwd.split(/[\\/]+/), ...segments]) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(segment);
  }

  return `${prefix}${normalized.join(separator)}`;
}

function readPackageVersion(
  cwd: string,
  readFile: (filePath: string) => string = (filePath) => readFileSync(filePath, "utf8"),
): string | null {
  if (!cwd) return null;
  const candidates = [
    joinPackagePath(cwd, ["package.json"]),
    joinPackagePath(cwd, ["..", "package.json"]),
    joinPackagePath(cwd, ["..", "..", "package.json"]),
  ];
  let fallback: string | null = null;

  for (const filePath of candidates) {
    try {
      const parsed = parseJsonObject(readFile(filePath));
      const version = normalizeReleaseVersion(parsed?.version);
      if (!version) continue;
      if (parsed?.name === "subboost") return version;
      fallback ??= version;
    } catch {
      continue;
    }
  }

  return fallback;
}

export async function resolveAppVersionInfo({
  env,
  cwd,
  readFile,
}: ResolveAppVersionInfoOptions): Promise<AppVersionInfo> {
  const explicitVersion = normalizeText(env.APP_VERSION);
  const explicitVersionToken = normalizeText(env.APP_VERSION_TOKEN);
  const buildSha =
    normalizeBuildSha(env.APP_BUILD_SHA) ??
    normalizeBuildSha(env.GITHUB_SHA) ??
    normalizeBuildSha(env.VERCEL_GIT_COMMIT_SHA) ??
    normalizeBuildSha(explicitVersion);
  const releaseVersion =
    normalizeReleaseVersion(env.APP_RELEASE_VERSION) ??
    inferReleaseVersion(explicitVersion) ??
    readPackageVersion(cwd, readFile) ??
    "0.0.0";
  const buildVersion = explicitVersion ?? formatBuildVersion(releaseVersion, buildSha);
  const versionToken = explicitVersionToken ?? (await formatVersionToken(releaseVersion, buildSha, buildVersion));

  return {
    version: versionToken,
    releaseVersion,
    buildSha,
    buildVersion,
    versionToken,
  };
}
