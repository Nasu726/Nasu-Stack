import type { ActionContext } from "@/lib/action";
import { ActionError, jsonRequest } from "@/lib/action";
import type { CursorPage } from "@/lib/cursor";
import type { PublicConfig } from "@/lib/config";

export interface RepositorySummary {
  id: number;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  defaultBranch: string;
  language: string | null;
  license: string | null;
  updatedAt: string;
}

export interface RepositoryIssue {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: "open" | "closed";
  kind: "Issue" | "Pull request";
  author: string;
  comments: number;
  labels: string[];
  updatedAt: string;
}

export interface RepositoryRelease {
  id: number;
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
  author: string;
}

export interface GithubClient {
  loadRepository: (input: void, context: ActionContext) => Promise<RepositorySummary>;
  loadReleases: (input: void, context: ActionContext) => Promise<RepositoryRelease[]>;
  searchIssues: (query: string, context: ActionContext) => Promise<RepositoryIssue[]>;
  loadIssuesPage: (
    cursor: number | undefined,
    context: ActionContext,
  ) => Promise<CursorPage<RepositoryIssue, number>>;
}

const PAGE_SIZE = 8;

export function createGithubClient(config: PublicConfig): GithubClient {
  const repositoryPath = `repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`;

  return {
    async loadRepository(_input, context) {
      const body = await requestUnknown(config, repositoryPath, {}, context);
      return parseResponse(body, parseRepository);
    },

    async loadReleases(_input, context) {
      const body = await requestUnknown(
        config,
        `${repositoryPath}/releases`,
        { per_page: "20" },
        context,
      );
      return parseResponse(body, parseReleases);
    },

    async searchIssues(query, context) {
      const body = await requestUnknown(
        config,
        "search/issues",
        {
          q: `repo:${config.owner}/${config.repository} ${query}`,
          sort: "updated",
          order: "desc",
          per_page: "10",
        },
        context,
      );
      return parseResponse(body, parseSearchResults);
    },

    async loadIssuesPage(cursor, context) {
      const page = cursor ?? 1;
      const body = await requestUnknown(
        config,
        `${repositoryPath}/issues`,
        {
          state: "all",
          sort: "updated",
          direction: "desc",
          per_page: String(PAGE_SIZE),
          page: String(page),
        },
        context,
      );
      const items = parseResponse(body, parseIssues);
      return {
        items,
        nextCursor: items.length === PAGE_SIZE ? page + 1 : null,
      };
    },
  };
}

async function requestUnknown(
  config: PublicConfig,
  path: string,
  params: Record<string, string>,
  context: ActionContext,
): Promise<unknown> {
  const url = new URL(path, config.apiBaseUrl);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  try {
    return await jsonRequest<unknown>(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ctx: context,
    });
  } catch (raw) {
    if (context.signal.aborted) throw raw;
    if (raw instanceof ActionError && (raw.code === 403 || raw.code === 429)) {
      throw new ActionError("GitHub API rate limit reached", {
        displayMessage:
          "GitHub's public API rate limit was reached. Wait a while, then try again.",
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError && raw.code === "BAD_RESPONSE") {
      throw new ActionError("GitHub returned a non-JSON response", {
        displayMessage:
          "GitHub returned data this app does not understand. Check the API URL, then try again.",
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError && typeof raw.code === "number") {
      throw new ActionError(`GitHub request failed (${raw.code})`, {
        displayMessage: `GitHub could not complete this request (${raw.code}). Check the repository settings, then try again.`,
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError) throw raw;
    throw new ActionError("GitHub API request failed", {
      displayMessage:
        "Could not reach the GitHub API. Check your connection and API URL, then try again.",
      code: "NETWORK",
      cause: raw,
    });
  }
}

function parseResponse<T>(value: unknown, parser: (input: unknown) => T): T {
  try {
    return parser(value);
  } catch (cause) {
    throw new ActionError("GitHub returned an unexpected response", {
      displayMessage:
        "GitHub returned data this app does not understand. Check the API URL, then try again.",
      code: "BAD_RESPONSE",
      cause,
    });
  }
}

function parseRepository(value: unknown): RepositorySummary {
  const record = asRecord(value, "repository");
  const licenseValue = record.license;
  let license: string | null = null;
  if (licenseValue !== null && licenseValue !== undefined) {
    license = readString(asRecord(licenseValue, "repository.license"), "spdx_id");
  }

  return {
    id: readInteger(record, "id"),
    fullName: readString(record, "full_name"),
    description: readNullableString(record, "description"),
    htmlUrl: readWebUrl(record, "html_url"),
    stars: readNonNegativeInteger(record, "stargazers_count"),
    forks: readNonNegativeInteger(record, "forks_count"),
    openIssues: readNonNegativeInteger(record, "open_issues_count"),
    defaultBranch: readString(record, "default_branch"),
    language: readNullableString(record, "language"),
    license,
    updatedAt: readDateString(record, "updated_at"),
  };
}

function parseIssues(value: unknown): RepositoryIssue[] {
  if (!Array.isArray(value)) throw new TypeError("issues must be an array");
  return value.map((item, index) => parseIssue(item, `issues[${index}]`));
}

function parseSearchResults(value: unknown): RepositoryIssue[] {
  const record = asRecord(value, "search result");
  return parseIssues(record.items);
}

function parseIssue(value: unknown, path: string): RepositoryIssue {
  const record = asRecord(value, path);
  const user = asRecord(record.user, `${path}.user`);
  const rawLabels = record.labels;
  if (!Array.isArray(rawLabels)) throw new TypeError(`${path}.labels must be an array`);
  const labels = rawLabels.map((label, index) => {
    if (typeof label === "string") return label;
    return readString(asRecord(label, `${path}.labels[${index}]`), "name");
  });
  const state = readString(record, "state");
  if (state !== "open" && state !== "closed") {
    throw new TypeError(`${path}.state is invalid`);
  }

  return {
    id: readInteger(record, "id"),
    number: readNonNegativeInteger(record, "number"),
    title: readString(record, "title"),
    htmlUrl: readWebUrl(record, "html_url"),
    state,
    kind: Object.hasOwn(record, "pull_request") ? "Pull request" : "Issue",
    author: readString(user, "login"),
    comments: readNonNegativeInteger(record, "comments"),
    labels,
    updatedAt: readDateString(record, "updated_at"),
  };
}

function parseReleases(value: unknown): RepositoryRelease[] {
  if (!Array.isArray(value)) throw new TypeError("releases must be an array");
  return value.map((item, index) => {
    const path = `releases[${index}]`;
    const record = asRecord(item, path);
    const author = asRecord(record.author, `${path}.author`);
    const tagName = readString(record, "tag_name");
    const name = readNullableString(record, "name");
    return {
      id: readInteger(record, "id"),
      tagName,
      name: name && name.trim().length > 0 ? name : tagName,
      htmlUrl: readWebUrl(record, "html_url"),
      publishedAt: readNullableDateString(record, "published_at"),
      prerelease: readBoolean(record, "prerelease"),
      draft: readBoolean(record, "draft"),
      author: readString(author, "login"),
    };
  });
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new TypeError(`${path} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${key} must be a string or null`);
  return value;
}

function readInteger(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`${key} must be a safe integer`);
  }
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string): number {
  const value = readInteger(record, key);
  if (value < 0) throw new TypeError(`${key} must be non-negative`);
  return value;
}

function readBoolean(record: Record<string, unknown>, key: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new TypeError(`${key} must be a boolean`);
  return value;
}

function readDateString(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  if (Number.isNaN(Date.parse(value))) throw new TypeError(`${key} must be a date`);
  return value;
}

function readNullableDateString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  if (record[key] === null) return null;
  return readDateString(record, key);
}

function readWebUrl(record: Record<string, unknown>, key: string): string {
  const value = readString(record, key);
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new TypeError(`${key} must be an HTTPS URL`);
  }
  return url.href;
}
