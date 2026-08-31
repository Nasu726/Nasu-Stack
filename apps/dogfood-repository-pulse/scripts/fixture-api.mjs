import http from "node:http";
import { pathToFileURL } from "node:url";

export function createFixtureApi() {
  let pageTwoAttempts = 0;

  return http.createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Allow-Headers",
      "accept, content-type, x-github-api-version",
    );
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/repos/example/pulse") {
      sendJson(response, 200, repositoryFixture());
      return;
    }

    if (url.pathname === "/repos/example/pulse/releases") {
      sendJson(response, 200, releaseFixtures());
      return;
    }

    if (url.pathname === "/repos/example/pulse/issues") {
      const page = Number(url.searchParams.get("page") ?? "1");
      if (page === 2 && pageTwoAttempts++ === 0) {
        sendJson(response, 503, {
          message: "fixture page failure",
          userMessage: "Do not expose this server text",
        });
        return;
      }
      sendJson(response, 200, page === 1 ? issueFixtures().slice(0, 8) : issueFixtures().slice(8));
      return;
    }

    if (url.pathname === "/search/issues") {
      const query = url.searchParams.get("q") ?? "";
      if (query.endsWith(" malformed")) {
        sendJson(response, 200, { items: [{ wrong: true }] });
        return;
      }
      if (query.endsWith(" slow")) {
        await delay(700);
        sendJson(response, 200, {
          items: [issueFixture(80, "Stale slow result must stay hidden")],
        });
        return;
      }
      const results = issueFixtures().filter((issue) =>
        issue.title.toLowerCase().includes(query.split(" ").at(-1)?.toLowerCase() ?? ""),
      );
      sendJson(response, 200, { items: results });
      return;
    }

    sendJson(response, 404, { message: "not found" });
  });
}

function repositoryFixture() {
  return {
    id: 726,
    full_name: "example/pulse",
    description: "A deterministic repository used by the browser verifier.",
    html_url: "https://github.com/example/pulse",
    stargazers_count: 1240,
    forks_count: 87,
    open_issues_count: 11,
    default_branch: "main",
    language: "TypeScript",
    license: { spdx_id: "MIT" },
    updated_at: "2026-08-30T12:00:00Z",
  };
}

function issueFixtures() {
  return [
    issueFixture(1, "Accessibility audit follow-up", { labels: ["a11y"] }),
    issueFixture(2, "Release checklist for v2.1", { pullRequest: true }),
    issueFixture(3, "Improve keyboard focus restoration"),
    issueFixture(4, "Document public configuration boundary"),
    issueFixture(5, "Release assets need stable checksums", { pullRequest: true }),
    issueFixture(6, "Responsive table card labels"),
    issueFixture(7, "Review rate limit recovery"),
    issueFixture(8, "Clarify copy-owned source updates"),
    issueFixture(9, "Add fixture-driven browser coverage", { pullRequest: true }),
    issueFixture(10, "Exercise cursor retry focus"),
    issueFixture(11, "Record dogfood observations", { state: "closed" }),
  ];
}

function issueFixture(
  number,
  title,
  { pullRequest = false, state = "open", labels = ["dogfood"] } = {},
) {
  return {
    id: 1000 + number,
    number,
    title,
    html_url: `https://github.com/example/pulse/${pullRequest ? "pull" : "issues"}/${number}`,
    state,
    user: { login: number % 2 === 0 ? "octo-reviewer" : "octo-builder" },
    comments: number % 4,
    labels: labels.map((name) => ({ name })),
    updated_at: `2026-08-${String(Math.max(1, 30 - number)).padStart(2, "0")}T12:00:00Z`,
    ...(pullRequest ? { pull_request: { url: "https://api.github.test/pull" } } : {}),
  };
}

function releaseFixtures() {
  return Array.from({ length: 7 }, (_, index) => {
    const version = `v2.0.${7 - index}`;
    return {
      id: 2000 + index,
      tag_name: version,
      name: `Repository Pulse ${version}`,
      html_url: `https://github.com/example/pulse/releases/tag/${version}`,
      published_at: `2026-08-${String(24 - index).padStart(2, "0")}T10:00:00Z`,
      prerelease: index === 0,
      draft: false,
      author: { login: "release-bot" },
    };
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FIXTURE_PORT ?? "5199");
  createFixtureApi().listen(port, "127.0.0.1", () => {
    console.log(`fixture API: http://127.0.0.1:${port}/`);
  });
}
