import type { LocationOption } from "@/lib/weather";

export interface PublicConfig {
  weatherApiBaseUrl: URL;
  geocodingApiBaseUrl: URL;
  locale: string;
  defaultLocation: LocationOption;
}

export class PublicConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super("Weather Planner is not configured");
    this.name = "PublicConfigError";
    this.problems = problems;
  }
}

/**
 * VITE_* values are public after build. This app only accepts public API URLs,
 * coordinates, and presentation settings here—never an API key or token.
 */
export function readPublicConfig(env: Record<string, unknown>): PublicConfig {
  const problems: string[] = [];
  const weatherApiBaseUrl = readBaseUrl(
    env.VITE_WEATHER_API_URL,
    "VITE_WEATHER_API_URL",
    "https://api.open-meteo.com/",
    problems,
  );
  const geocodingApiBaseUrl = readBaseUrl(
    env.VITE_GEOCODING_API_URL,
    "VITE_GEOCODING_API_URL",
    "https://geocoding-api.open-meteo.com/",
    problems,
  );
  const latitude = readCoordinate(
    env.VITE_DEFAULT_LATITUDE,
    "VITE_DEFAULT_LATITUDE",
    35.6762,
    -90,
    90,
    problems,
  );
  const longitude = readCoordinate(
    env.VITE_DEFAULT_LONGITUDE,
    "VITE_DEFAULT_LONGITUDE",
    139.6503,
    -180,
    180,
    problems,
  );
  const locale = readLocale(env.VITE_DEFAULT_LOCALE, problems);
  const name = readLabel(
    env.VITE_DEFAULT_LOCATION,
    "VITE_DEFAULT_LOCATION",
    "Tokyo",
    problems,
  );
  const country = readLabel(
    env.VITE_DEFAULT_COUNTRY,
    "VITE_DEFAULT_COUNTRY",
    "Japan",
    problems,
  );

  if (
    problems.length > 0 ||
    !weatherApiBaseUrl ||
    !geocodingApiBaseUrl ||
    latitude === undefined ||
    longitude === undefined ||
    !locale ||
    !name ||
    !country
  ) {
    throw new PublicConfigError(problems);
  }

  return {
    weatherApiBaseUrl,
    geocodingApiBaseUrl,
    locale,
    defaultLocation: {
      id: `default:${latitude}:${longitude}`,
      name,
      country,
      countryCode: "",
      admin1: null,
      latitude,
      longitude,
      timezone: "auto",
    },
  };
}

function readBaseUrl(
  value: unknown,
  name: string,
  fallback: string,
  problems: string[],
): URL | undefined {
  const source =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : fallback;
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    problems.push(`${name} must be an absolute URL.`);
    return undefined;
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  if (url.protocol !== "https:" && !isLocalHttp) {
    problems.push(
      `${name} must use HTTPS (HTTP is allowed only for localhost fixtures).`,
    );
  }
  if (url.username || url.password) {
    problems.push(`${name} must not contain credentials.`);
  }
  if (url.search || url.hash) {
    problems.push(`${name} must not contain a query or fragment.`);
  }

  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}

function readCoordinate(
  value: unknown,
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
  problems: string[],
): number | undefined {
  const parsed =
    value === undefined || value === ""
      ? fallback
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    problems.push(`${name} must be a number from ${minimum} to ${maximum}.`);
    return undefined;
  }
  return parsed;
}

function readLocale(value: unknown, problems: string[]): string | undefined {
  const locale =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : "en";
  try {
    new Intl.DateTimeFormat(locale).format(new Date(0));
    return locale;
  } catch {
    problems.push("VITE_DEFAULT_LOCALE must be a valid locale such as en or ja-JP.");
    return undefined;
  }
}

function readLabel(
  value: unknown,
  name: string,
  fallback: string,
  problems: string[],
): string | undefined {
  const label =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : fallback;
  if (label.length > 80) {
    problems.push(`${name} must be 80 characters or fewer.`);
    return undefined;
  }
  return label;
}
