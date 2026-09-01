import * as React from "react";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { AsyncSelect } from "@/components/ui/async-select";
import { Button } from "@/components/ui/action-button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  Box,
  Inline,
  PageBlock,
  Section,
  Spread,
  Stack,
  Tiles,
} from "@/components/ui/layout";
import { Popover } from "@/components/ui/popover";
import { SiteFooter } from "@/components/ui/site-footer";
import { SiteHeader, SkipLink } from "@/components/ui/site-nav";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { useAutosave } from "@/hooks/use-autosave";
import { useResource } from "@/hooks/use-resource";
import {
  PublicConfigError,
  readPublicConfig,
  type PublicConfig,
} from "@/lib/config";
import {
  ACTIVITY_OPTIONS,
  emptyDraft,
  readPlannerDraft,
  savePlannerDraft,
  type Activity,
  type DayPlan,
  type PlannerDraft,
} from "@/lib/planner";
import {
  createWeatherClient,
  locationLabel,
  type Forecast,
  type ForecastDay,
  type LocationOption,
} from "@/lib/weather";

const NAVIGATION = [
  { href: "#forecast", label: "Forecast" },
  { href: "#planner", label: "Plan" },
  { href: "#about", label: "About" },
];

type ConfigResult =
  | { ok: true; config: PublicConfig }
  | { ok: false; problems: readonly string[] };

export function App() {
  const result = React.useMemo<ConfigResult>(() => {
    try {
      return { ok: true, config: readPublicConfig(import.meta.env) };
    } catch (error) {
      if (error instanceof PublicConfigError) {
        return { ok: false, problems: error.problems };
      }
      return { ok: false, problems: ["The public configuration could not be read."] };
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="vivid" persist={false}>
      {result.ok ? (
        <WeatherPlanner config={result.config} />
      ) : (
        <ConfigurationScreen problems={result.problems} />
      )}
    </ThemeProvider>
  );
}

function WeatherPlanner({ config }: { config: PublicConfig }) {
  const [restored] = React.useState(() => readPlannerDraft(config.defaultLocation));
  const [draft, setDraft] = React.useState<PlannerDraft>(restored.draft);
  const draftRef = React.useRef(draft);
  draftRef.current = draft;
  const client = React.useMemo(() => createWeatherClient(config), [config]);
  const autosave = useAutosave(savePlannerDraft, { delay: 650 });

  const forecast = useResource<Forecast>(
    [
      "forecast",
      draft.location.latitude,
      draft.location.longitude,
      config.weatherApiBaseUrl.href,
    ],
    React.useCallback(
      (_input, context) => client.loadForecast(draft.location, context),
      [client, draft.location],
    ),
    { retry: 1 },
  );

  const replaceDraft = React.useCallback(
    (next: PlannerDraft) => {
      draftRef.current = next;
      setDraft(next);
      autosave.schedule(next);
    },
    [autosave],
  );

  function selectLocation(location: LocationOption | null) {
    if (!location || location.id === draftRef.current.location.id) return;
    replaceDraft(emptyDraft(location));
  }

  function updatePlan(date: string, patch: Partial<DayPlan>) {
    const current = draftRef.current;
    const previous = current.plans[date] ?? {
      activity: "flexible" as Activity,
      note: "",
    };
    const nextPlan = { ...previous, ...patch };
    const plans = { ...current.plans, [date]: nextPlan };
    if (nextPlan.activity === "flexible" && nextPlan.note.trim().length === 0) {
      delete plans[date];
    }
    replaceDraft({ ...current, plans });
  }

  function clearPlans() {
    replaceDraft({ ...draftRef.current, plans: Object.create(null) });
  }

  const plannedDays = Object.values(draft.plans).filter(
    (plan) => plan.activity !== "flexible" || plan.note.trim().length > 0,
  ).length;

  return (
    <>
      <SkipLink children="Skip to the weather planner" />
      <SiteHeader
        brand="Weather Planner"
        brandHref="/"
        items={NAVIGATION}
        width="wide"
      />

      <main id="main" tabIndex={-1} data-weather-planner="">
        <section className="overflow-hidden border-b border-border bg-accent/35">
          <PageBlock width="wide" gutter="md" className="py-2xl md:py-3xl">
            <Stack space="xl">
              <div className="max-w-3xl">
                <Stack space="md">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                    A state-heavy Nasu Stack example
                  </p>
                  <h1 className="text-4xl leading-[1.05] md:text-6xl">
                    Give the week a little room to change.
                  </h1>
                  <p className="max-w-prose text-lg leading-relaxed text-muted-fg">
                    Search for a place, read the seven-day outlook, and attach a
                    lightweight plan to each day. Your draft stays in this browser.
                  </p>
                </Stack>
              </div>

              <Box
                background="card"
                border
                radius="xl"
                shadow="e2"
                padding={{ mobile: "md", tablet: "lg" }}
                className="max-w-2xl"
              >
                <AsyncSelect<LocationOption>
                  label="Location"
                  name="location"
                  value={draft.location}
                  onChange={selectLocation}
                  loader={client.searchLocations}
                  getKey={(location) => location.id}
                  getLabel={locationLabel}
                  getFormValue={(location) => location.id}
                  renderItem={(location) => (
                    <span className="flex w-full min-w-0 flex-col">
                      <span className="truncate font-medium">{location.name}</span>
                      <span className="truncate text-xs text-muted-fg">
                        {[location.admin1, location.country].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  )}
                  placeholder="Search by city or place"
                  hint="Type at least two characters. Choosing a new place starts a new local plan."
                  searchOnEmpty={false}
                  required
                />
              </Box>
            </Stack>
          </PageBlock>
        </section>

        <PageBlock width="wide" gutter="md" className="py-2xl">
          <Stack space="2xl">
            <Section space="lg" id="forecast">
              <Spread space="md" alignY="end">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary">Seven-day outlook</p>
                  <h2 className="text-3xl leading-tight">
                    {locationLabel(draft.location)}
                  </h2>
                </div>
                <a
                  href="https://open-meteo.com/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center text-sm text-muted-fg underline underline-offset-4 hover:text-fg"
                >
                  Weather data by Open-Meteo.com
                </a>
              </Spread>

              <ErrorBoundary
                resetKeys={[draft.location.id, forecast.status]}
                title="The forecast section could not be displayed"
                description="The planner is still available. Try rendering the forecast again."
                retryLabel="Render again"
              >
                <AsyncBoundary
                  state={forecast}
                  onRetry={forecast.refetch}
                  retryLabel="Try the forecast again"
                  skeletonRows={7}
                  empty={
                    <p className="rounded-xl border border-dashed border-border p-lg text-muted-fg">
                      No forecast days were returned for this location.
                    </p>
                  }
                >
                  {(data) => (
                    <ForecastGrid
                      forecast={data}
                      locale={config.locale}
                      plans={draft.plans}
                      onPlanChange={updatePlan}
                    />
                  )}
                </AsyncBoundary>
              </ErrorBoundary>
            </Section>

            <Section space="lg" id="planner">
              <Spread space="md" alignY="center">
                <div>
                  <p className="text-sm font-medium text-primary">Local draft</p>
                  <h2 className="text-3xl">Plan status</h2>
                </div>
                <Popover trigger="Plan options" align="end" contentClassName="w-64">
                  {({ close }) => (
                    <Stack space="sm">
                      <p className="leading-relaxed text-muted-fg">
                        Plans are stored only in this browser. Clearing them does not
                        affect the weather service.
                      </p>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={plannedDays === 0}
                        onClick={() => {
                          clearPlans();
                          close();
                        }}
                      >
                        Clear this week
                      </Button>
                    </Stack>
                  )}
                </Popover>
              </Spread>

              <Box background="muted" radius="xl" padding="lg">
                <Stack space="md">
                  <Inline space="lg" alignY="baseline">
                    <p className="text-4xl font-semibold" data-planned-count="">
                      {plannedDays}
                    </p>
                    <p className="text-muted-fg">
                      {plannedDays === 1 ? "day has a plan" : "days have a plan"}
                    </p>
                  </Inline>
                  <SaveStatus
                    status={autosave.status}
                    savedAt={autosave.data?.savedAt}
                    restored={restored.restored}
                    locale={config.locale}
                    error={autosave.error?.displayMessage}
                    onFlush={autosave.flush}
                    onRetry={autosave.retry}
                  />
                </Stack>
              </Box>
            </Section>

            <Section space="md" id="about">
              <h2 className="text-2xl">What this example does—and does not do</h2>
              <Tiles columns={{ mobile: 1, tablet: 2 }} space="md">
                <Box border radius="lg" padding="md">
                  <Stack space="sm">
                    <h3 className="text-lg">Handled here</h3>
                    <p className="leading-relaxed text-muted-fg">
                      Stale requests are discarded, search is debounced, drafts use a
                      latest-only autosave queue, and malformed API data fails closed.
                    </p>
                  </Stack>
                </Box>
                <Box border radius="lg" padding="md">
                  <Stack space="sm">
                    <h3 className="text-lg">Left to your application</h3>
                    <p className="leading-relaxed text-muted-fg">
                      Browser storage is not cross-device sync. Commercial API access,
                      account data, conflict resolution, and offline forecasts belong to
                      your server and product domain.
                    </p>
                  </Stack>
                </Box>
              </Tiles>
            </Section>
          </Stack>
        </PageBlock>
      </main>

      <SiteFooter
        brand="Weather Planner"
        description="A free-to-start, state-heavy example built with copy-owned Nasu Stack source."
        groups={[
          {
            label: "Data",
            items: [
              { href: "https://open-meteo.com/", label: "Open-Meteo", external: true },
              {
                href: "https://open-meteo.com/en/license",
                label: "Data licence",
                external: true,
              },
            ],
          },
        ]}
        note="The free Open-Meteo endpoint is for non-commercial use and has usage limits. Attribution is required."
        width="wide"
      />
    </>
  );
}

function ForecastGrid({
  forecast,
  locale,
  plans,
  onPlanChange,
}: {
  forecast: Forecast;
  locale: string;
  plans: Record<string, DayPlan>;
  onPlanChange: (date: string, patch: Partial<DayPlan>) => void;
}) {
  return (
    <Tiles columns={{ mobile: 1, tablet: 2, desktop: 3 }} space="md">
      {forecast.days.map((day) => (
        <ForecastCard
          key={day.date}
          day={day}
          forecast={forecast}
          locale={locale}
          plan={plans[day.date]}
          onChange={(patch) => onPlanChange(day.date, patch)}
        />
      ))}
    </Tiles>
  );
}

function ForecastCard({
  day,
  forecast,
  locale,
  plan,
  onChange,
}: {
  day: ForecastDay;
  forecast: Forecast;
  locale: string;
  plan: DayPlan | undefined;
  onChange: (patch: Partial<DayPlan>) => void;
}) {
  const weather = describeWeather(day.weatherCode);
  const activity = plan?.activity ?? "flexible";
  const note = plan?.note ?? "";
  const dayLabel = formatDate(day.date, locale, { weekday: "long" });
  const dateLabel = formatDate(day.date, locale, { month: "short", day: "numeric" });

  return (
    <article
      className="flex min-w-0 flex-col gap-md rounded-xl border border-border bg-card p-md shadow-e1"
      data-forecast-date={day.date}
    >
      <Spread space="sm" alignY="start">
        <div>
          <h3 className="text-xl">{dayLabel}</h3>
          <p className="text-sm text-muted-fg">{dateLabel}</p>
        </div>
        <span className="text-3xl" role="img" aria-label={weather.label}>
          {weather.icon}
        </span>
      </Spread>

      <div>
        <p className="font-medium" data-weather-code={day.weatherCode}>
          {weather.label}
        </p>
        <p className="text-sm text-muted-fg">
          <span className="text-lg font-semibold text-fg">
            {formatNumber(day.temperatureMax, locale)}{forecast.temperatureUnit}
          </span>{" "}
          / {formatNumber(day.temperatureMin, locale)}{forecast.temperatureUnit}
          {" · "}{formatNumber(day.precipitationProbability, locale)}
          {forecast.precipitationUnit} rain
        </p>
      </div>

      <Popover trigger="Forecast details" contentClassName="w-64">
        <dl className="grid grid-cols-[auto_1fr] gap-x-sm gap-y-2xs">
          <dt className="text-muted-fg">Wind</dt>
          <dd className="text-right">
            {formatNumber(day.windSpeedMax, locale)} {forecast.windSpeedUnit}
          </dd>
          <dt className="text-muted-fg">Sunrise</dt>
          <dd className="text-right">{formatClock(day.sunrise)}</dd>
          <dt className="text-muted-fg">Sunset</dt>
          <dd className="text-right">{formatClock(day.sunset)}</dd>
          <dt className="text-muted-fg">Timezone</dt>
          <dd className="min-w-0 break-words text-right">{forecast.timezone}</dd>
        </dl>
      </Popover>

      <fieldset className="min-w-0">
        <legend className="mb-xs text-sm font-medium">Plan the day</legend>
        <div className="grid grid-cols-2 gap-xs">
          {ACTIVITY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-xs rounded-md border border-input px-sm text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
            >
              <input
                type="radio"
                name={`activity-${day.date}`}
                value={option.value}
                checked={activity === option.value}
                onChange={() => onChange({ activity: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex min-w-0 flex-col gap-xs text-sm font-medium">
        Note <span className="font-normal text-muted-fg">(optional)</span>
        <textarea
          value={note}
          maxLength={240}
          rows={3}
          aria-label={`Plan note for ${dayLabel}, ${dateLabel}`}
          placeholder="What would make this day easier?"
          onChange={(event) => onChange({ note: event.currentTarget.value })}
          className="min-h-24 w-full resize-y rounded-md border border-input bg-bg px-sm py-xs text-base font-normal text-fg outline-none placeholder:text-muted-fg focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
    </article>
  );
}

function SaveStatus({
  status,
  savedAt,
  restored,
  locale,
  error,
  onFlush,
  onRetry,
}: {
  status: "idle" | "dirty" | "saving" | "saved" | "error";
  savedAt: number | undefined;
  restored: boolean;
  locale: string;
  error: string | undefined;
  onFlush: () => void;
  onRetry: () => void;
}) {
  let message = restored
    ? "A previous plan was restored from this browser."
    : "Changes will be stored in this browser.";
  if (status === "dirty") message = "Unsaved changes are waiting.";
  if (status === "saving") message = "Saving the latest plan…";
  if (status === "saved") {
    message = savedAt
      ? `Saved in this browser at ${new Intl.DateTimeFormat(locale, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }).format(savedAt)}.`
      : "Saved in this browser.";
  }
  if (status === "error") message = error ?? "The plan could not be saved.";

  return (
    <div data-save-status={status}>
      <Inline space="sm" alignY="center">
        <p
          role={status === "error" ? "alert" : "status"}
          aria-live="polite"
          className={status === "error" ? "text-danger" : "text-muted-fg"}
        >
          {message}
        </p>
        {status === "dirty" && (
          <Button variant="outline" size="sm" onClick={onFlush}>
            Save now
          </Button>
        )}
        {status === "error" && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try saving again
          </Button>
        )}
      </Inline>
    </div>
  );
}

function ConfigurationScreen({ problems }: { problems: readonly string[] }) {
  return (
    <PageBlock
      width="prose"
      gutter="md"
      as="main"
      id="main"
      tabIndex={-1}
      className="py-3xl"
    >
      <Box border radius="xl" padding="lg" className="border-danger/40 bg-danger/5">
        <Stack space="md">
          <p className="text-sm font-medium uppercase tracking-wider text-danger">
            Configuration needed
          </p>
          <h1 className="text-3xl">Weather Planner could not start</h1>
          <p className="leading-relaxed text-muted-fg">
            Fix the public values below in <code>.env</code>, then restart the
            development server. Never place an API key in a <code>VITE_*</code>
            variable.
          </p>
          <ul className="grid list-disc gap-xs pl-lg" role="alert">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Stack>
      </Box>
    </PageBlock>
  );
}

function describeWeather(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear sky", icon: "☀️" };
  if ([1, 2, 3].includes(code)) return { label: "Partly cloudy", icon: "⛅" };
  if ([45, 48].includes(code)) return { label: "Fog", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", icon: "🌦️" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { label: "Rain", icon: "🌧️" };
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { label: "Snow", icon: "🌨️" };
  }
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "Variable weather", icon: "🌤️" };
}

function formatDate(
  date: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

function formatClock(value: string) {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? value;
}
