export interface PublicConfig {
  owner: string;
  repository: string;
  apiBaseUrl: URL;
}

export class PublicConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super("Repository Pulse is not configured");
    this.name = "PublicConfigError";
    this.problems = problems;
  }
}

const REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]+$/;

/**
 * VITE_* values are public after build. This app deliberately accepts only
 * repository coordinates and an API URL here—never an access token.
 */
export function readPublicConfig(
  env: Record<string, unknown>,
): PublicConfig {
  const problems: string[] = [];
  const owner = readRepositorySegment(env.VITE_GITHUB_OWNER, "VITE_GITHUB_OWNER", problems);
  const repository = readRepositorySegment(
    env.VITE_GITHUB_REPO,
    "VITE_GITHUB_REPO",
    problems,
  );
  const apiBaseUrl = readApiBaseUrl(env.VITE_GITHUB_API_URL, problems);

  if (problems.length > 0 || !owner || !repository || !apiBaseUrl) {
    throw new PublicConfigError(problems);
  }

  return {
    owner,
    repository,
    apiBaseUrl,
  };
}

function readRepositorySegment(
  value: unknown,
  name: string,
  problems: string[],
): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    problems.push(`${name} is required.`);
    return undefined;
  }

  const normalized = value.trim();
  if (
    !REPOSITORY_SEGMENT.test(normalized) ||
    normalized === "." ||
    normalized === ".."
  ) {
    problems.push(`${name} must be one GitHub path segment, without a slash.`);
    return undefined;
  }
  return normalized;
}

function readApiBaseUrl(
  value: unknown,
  problems: string[],
): URL | undefined {
  const source =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : "https://api.github.com/";

  let url: URL;
  try {
    url = new URL(source);
  } catch {
    problems.push("VITE_GITHUB_API_URL must be an absolute URL.");
    return undefined;
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !isLocalHttp) {
    problems.push(
      "VITE_GITHUB_API_URL must use HTTPS (HTTP is allowed only for localhost fixtures).",
    );
  }
  if (url.username || url.password) {
    problems.push("VITE_GITHUB_API_URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    problems.push("VITE_GITHUB_API_URL must not contain a query or fragment.");
  }

  if (problems.length > 0) return undefined;
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
