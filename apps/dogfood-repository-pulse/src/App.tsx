import * as React from "react";
import {
  SearchListRecipe,
  type SearchListItem,
} from "@/components/recipes/search-list";
import { ActionProvider } from "@/components/ui/action-provider";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { CopyButton } from "@/components/ui/copy-button";
import {
  DataTable,
  type TableColumn,
} from "@/components/ui/data-table";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { LoadMoreList } from "@/components/ui/load-more-list";
import {
  Box,
  Inline,
  PageBlock,
  Section,
  Stack,
} from "@/components/ui/layout";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader, SkipLink } from "@/components/ui/site-nav";
import { ThemeProvider, ThemeSwitcher } from "@/components/ui/theme-provider";
import { useResource } from "@/hooks/use-resource";
import {
  PublicConfigError,
  readPublicConfig,
  type PublicConfig,
} from "@/lib/config";
import {
  createGithubClient,
  type GithubClient,
  type RepositoryIssue,
  type RepositoryRelease,
  type RepositorySummary,
} from "@/lib/github";

const NAVIGATION = [
  { href: "#overview", label: "Overview" },
  { href: "#search", label: "Search" },
  { href: "#recent", label: "Recent work" },
  { href: "#releases", label: "Releases" },
];

const NUMBER = new Intl.NumberFormat("en-US", { notation: "compact" });
const DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

type ConfigResult =
  | { ok: true; value: PublicConfig }
  | { ok: false; error: PublicConfigError };

const CONFIG_RESULT: ConfigResult = (() => {
  try {
    return {
      ok: true,
      value: readPublicConfig(import.meta.env as Record<string, unknown>),
    };
  } catch (error) {
    if (error instanceof PublicConfigError) return { ok: false, error };
    return {
      ok: false,
      error: new PublicConfigError(["The public configuration could not be read."]),
    };
  }
})();

export function App() {
  return (
    <ThemeProvider defaultTheme="neutral" storageKey="repository-pulse.theme.v2">
      <ActionProvider>
        <SkipLink />
        <SiteHeader
          brand="Repository Pulse"
          brandHref={import.meta.env.BASE_URL}
          items={CONFIG_RESULT.ok ? NAVIGATION : []}
          actions={<ThemeSwitcher />}
          width="wide"
        />

        {CONFIG_RESULT.ok ? (
          <ErrorBoundary
            title="Repository data could not be displayed"
            description="The page shell is still available. Try rendering the repository view again."
            retryLabel="Render again"
          >
            <RepositoryApplication config={CONFIG_RESULT.value} />
          </ErrorBoundary>
        ) : (
          <ConfigurationError error={CONFIG_RESULT.error} />
        )}

        <SiteFooter
          brand="Repository Pulse"
          description="A read-heavy Nasu Stack dogfood app. Public data only; no browser token."
          groups={[
            {
              label: "Project",
              items: [
                {
                  href: "https://github.com/Nasu726/Nasu-Stack",
                  label: "Nasu Stack",
                  external: true,
                },
              ],
            },
          ]}
          note="Built from the packed create-nasu-stack CLI and the public shadcn registry."
          width="wide"
        />
      </ActionProvider>
    </ThemeProvider>
  );
}

function RepositoryApplication({ config }: { config: PublicConfig }) {
  const client = React.useMemo(() => createGithubClient(config), [config]);

  return (
    <PageBlock
      as="main"
      id="main"
      tabIndex={-1}
      width="wide"
      gutter={{ mobile: "md", tablet: "lg" }}
      className="outline-none"
    >
      <Stack space="3xl">
        <RepositoryOverview client={client} config={config} />
        <RepositorySearch client={client} />
        <RecentWork client={client} config={config} />
        <ReleaseHistory client={client} config={config} />
      </Stack>
    </PageBlock>
  );
}

function RepositoryOverview({
  client,
  config,
}: {
  client: GithubClient;
  config: PublicConfig;
}) {
  const repository = useResource<RepositorySummary>(
    ["repository", config.owner, config.repository, config.apiBaseUrl.href],
    client.loadRepository,
    { retry: 0 },
  );

  return (
    <Section id="overview" space="3xl">
      <Stack space="xl">
        <Stack space="sm" className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Nasu Stack dogfood · public GitHub data
          </p>
          <h1 className="text-4xl leading-tight sm:text-5xl">
            See what is moving in a repository.
          </h1>
          <p className="max-w-prose text-base leading-relaxed text-muted-fg sm:text-lg">
            Repository Pulse keeps summary, search, pagination, and release states
            explicit without putting a private token in browser code.
          </p>
        </Stack>

        <AsyncBoundary
          state={repository}
          onRetry={repository.refetch}
          retryLabel="Try again"
          skeletonRows={5}
        >
          {(data) => <RepositorySummaryCard repository={data} />}
        </AsyncBoundary>
      </Stack>
    </Section>
  );
}

function RepositorySummaryCard({ repository }: { repository: RepositorySummary }) {
  const metrics = [
    { label: "Stars", value: NUMBER.format(repository.stars) },
    { label: "Forks", value: NUMBER.format(repository.forks) },
    { label: "Open issues", value: NUMBER.format(repository.openIssues) },
    { label: "Default branch", value: repository.defaultBranch },
  ];

  return (
    <Box padding={{ mobile: "md", tablet: "xl" }} background="card" border radius="xl" shadow="e1">
      <Stack space="lg">
        <Stack space="xs">
          <Inline space="sm" alignY="baseline">
            <h2 className="min-w-0 break-words text-2xl font-semibold">
              <a className="hover:text-primary" href={repository.htmlUrl}>
                {repository.fullName}
              </a>
            </h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-fg">
              {repository.language ?? "Language not reported"}
            </span>
          </Inline>
          <p className="max-w-prose leading-relaxed text-muted-fg">
            {repository.description ?? "This repository has no description."}
          </p>
        </Stack>

        <dl className="grid min-w-0 grid-cols-2 gap-md lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-lg bg-muted p-md">
              <dt className="text-xs text-muted-fg">{metric.label}</dt>
              <dd className="mt-1 break-words text-lg font-semibold">{metric.value}</dd>
            </div>
          ))}
        </dl>

        <Inline space="md" alignY="center">
          <CopyButton text={repository.htmlUrl} resetAfter={2500}>
            Copy repository URL
          </CopyButton>
          <p className="text-sm text-muted-fg">
            {repository.license ? `${repository.license} · ` : ""}
            Updated {formatDate(repository.updatedAt)}
          </p>
        </Inline>
      </Stack>
    </Box>
  );
}

function RepositorySearch({ client }: { client: GithubClient }) {
  const search = React.useCallback(
    async (query: string, context: Parameters<GithubClient["searchIssues"]>[1]) => {
      const issues = await client.searchIssues(query, context);
      return issues.map<SearchListItem>((issue) => ({
        id: issue.id,
        href: issue.htmlUrl,
        title: `${issue.kind} #${issue.number}: ${issue.title}`,
        description: `${capitalize(issue.state)} · ${issue.author} · updated ${formatDate(issue.updatedAt)}`,
      }));
    },
    [client],
  );

  return (
    <Section id="search" space="none">
      <Stack space="lg">
        <SectionHeading
          eyebrow="Find work"
          title="Search issues and pull requests"
          description="Search is debounced, stale requests are cancelled, and every result remains a real link. GitHub owns ranking and rate limits."
        />
        <Box padding={{ mobile: "md", tablet: "lg" }} background="card" border radius="lg">
          <SearchListRecipe
            search={search}
            minQueryLength={2}
            debounceMs={300}
            retry={0}
            messages={{
              label: "Issue or pull request search",
              placeholder: "Try accessibility or release…",
              searching: "Searching GitHub…",
              empty: "No matching issues or pull requests.",
              retry: "Try search again",
            }}
          />
        </Box>
      </Stack>
    </Section>
  );
}

function RecentWork({
  client,
  config,
}: {
  client: GithubClient;
  config: PublicConfig;
}) {
  return (
    <Section id="recent" space="none">
      <Stack space="lg">
        <SectionHeading
          eyebrow="Cursor composition"
          title="Recently updated work"
          description="More results load only when requested. A failed page keeps the items already on screen and offers a focused retry."
        />
        <LoadMoreList<RepositoryIssue, number>
          loader={client.loadIssuesPage}
          deps={[config.owner, config.repository, config.apiBaseUrl.href]}
          getKey={(issue) => issue.id}
          renderItem={(issue) => <IssueRow issue={issue} />}
          labels={{
            loading: "Loading recent work…",
            loadMore: "Load more work",
            loadingMore: "Loading more work…",
            retry: "Try this page again",
            empty: "No issues or pull requests were returned.",
            end: "That is all the recent work GitHub returned.",
            itemCount: (count) => `${count} ${count === 1 ? "item" : "items"}`,
          }}
        />
      </Stack>
    </Section>
  );
}

function IssueRow({ issue }: { issue: RepositoryIssue }) {
  return (
    <article className="min-w-0">
      <Stack space="xs">
        <Inline space="xs" alignY="center">
          <span
            className={
              issue.state === "open"
                ? "rounded-full bg-success/15 px-2 py-0.5 text-xs text-success"
                : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-fg"
            }
          >
            {capitalize(issue.state)}
          </span>
          <span className="text-xs text-muted-fg">
            {issue.kind} #{issue.number}
          </span>
        </Inline>
        <a className="break-words font-medium hover:text-primary" href={issue.htmlUrl}>
          {issue.title}
        </a>
        <p className="text-sm text-muted-fg">
          {issue.author} · {issue.comments} {issue.comments === 1 ? "comment" : "comments"} · updated {formatDate(issue.updatedAt)}
        </p>
        {issue.labels.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-1.5" aria-label="Labels">
            {issue.labels.slice(0, 4).map((label) => (
              <li key={label} className="max-w-full truncate rounded-md border border-border px-2 py-0.5 text-xs text-muted-fg">
                {label}
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </article>
  );
}

function ReleaseHistory({
  client,
  config,
}: {
  client: GithubClient;
  config: PublicConfig;
}) {
  const releases = useResource<RepositoryRelease[]>(
    ["releases", config.owner, config.repository, config.apiBaseUrl.href],
    client.loadReleases,
    { retry: 0 },
  );

  return (
    <Section id="releases" space="none">
      <Stack space="lg">
        <SectionHeading
          eyebrow="Responsive data"
          title="Release history"
          description="The same rows become labelled cards on narrow screens instead of forcing a wide table into 320 pixels."
        />
        <AsyncBoundary
          state={releases}
          onRetry={releases.refetch}
          retryLabel="Try releases again"
          isEmpty={(items) => items.length === 0}
          empty={
            <p className="rounded-lg border border-dashed border-border p-xl text-center text-sm text-muted-fg">
              This repository has no releases.
            </p>
          }
          skeletonRows={5}
        >
          {(items) => (
            <DataTable
              rows={items}
              columns={RELEASE_COLUMNS}
              getKey={(release) => release.id}
              pageSize={5}
              mobile="cards"
              caption="Published releases"
            />
          )}
        </AsyncBoundary>
      </Stack>
    </Section>
  );
}

const RELEASE_COLUMNS: TableColumn<RepositoryRelease>[] = [
  {
    key: "tagName",
    label: "Release",
    sortable: true,
    get: (release) => (
      <a className="font-medium hover:text-primary" href={release.htmlUrl}>
        {release.name}
      </a>
    ),
    sortValue: (release) => release.tagName,
  },
  {
    key: "tag",
    label: "Tag",
    get: (release) => <code className="text-xs">{release.tagName}</code>,
  },
  {
    key: "publishedAt",
    label: "Published",
    sortable: true,
    get: (release) =>
      release.publishedAt ? formatDate(release.publishedAt) : "Not published",
    sortValue: (release) => release.publishedAt ?? "",
  },
  {
    key: "status",
    label: "Status",
    get: (release) =>
      release.draft ? "Draft" : release.prerelease ? "Pre-release" : "Stable",
  },
  {
    key: "author",
    label: "Author",
    hideOnCard: true,
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Stack space="xs" className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
      <p className="max-w-prose leading-relaxed text-muted-fg">{description}</p>
    </Stack>
  );
}

function ConfigurationError({ error }: { error: PublicConfigError }) {
  return (
    <PageBlock
      as="main"
      id="main"
      tabIndex={-1}
      width="narrow"
      gutter="md"
      className="py-3xl outline-none"
    >
      <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-lg">
        <Stack space="md">
          <Stack space="xs">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">
              Configuration required
            </p>
            <h1 className="text-2xl font-semibold">Repository Pulse cannot start yet</h1>
            <p className="leading-relaxed text-muted-fg">
              Copy <code>.env.example</code> to <code>.env</code>, correct the values below,
              and restart the development server.
            </p>
          </Stack>
          <ul className="list-disc space-y-2 ps-5 text-sm">
            {error.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-fg">
            Do not add a GitHub token to a <code>VITE_*</code> variable. Those values are public.
          </p>
        </Stack>
      </div>
    </PageBlock>
  );
}

function formatDate(value: string): string {
  return DATE.format(new Date(value));
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
