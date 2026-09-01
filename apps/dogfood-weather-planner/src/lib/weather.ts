import type { ActionContext } from "@/lib/action";
import { ActionError, jsonRequest } from "@/lib/action";
import type { PublicConfig } from "@/lib/config";

export interface LocationOption {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  admin1: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface ForecastDay {
  date: string;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
}

export interface Forecast {
  timezone: string;
  temperatureUnit: string;
  windSpeedUnit: string;
  precipitationUnit: string;
  days: ForecastDay[];
}

export interface WeatherClient {
  searchLocations: (
    query: string,
    context: ActionContext,
  ) => Promise<LocationOption[]>;
  loadForecast: (
    location: LocationOption,
    context: ActionContext,
  ) => Promise<Forecast>;
}

export function createWeatherClient(config: PublicConfig): WeatherClient {
  return {
    async searchLocations(query, context) {
      const normalized = query.trim();
      if (normalized.length < 2) return [];
      const url = new URL("v1/search", config.geocodingApiBaseUrl);
      url.searchParams.set("name", normalized);
      url.searchParams.set("count", "7");
      url.searchParams.set("language", config.locale.split("-")[0] || "en");
      url.searchParams.set("format", "json");
      const body = await requestUnknown(url, "location search", context);
      return parseLocations(body);
    },

    async loadForecast(location, context) {
      const url = new URL("v1/forecast", config.weatherApiBaseUrl);
      url.searchParams.set("latitude", String(location.latitude));
      url.searchParams.set("longitude", String(location.longitude));
      url.searchParams.set(
        "daily",
        [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
          "wind_speed_10m_max",
          "sunrise",
          "sunset",
        ].join(","),
      );
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "7");
      const body = await requestUnknown(url, "forecast", context);
      return parseForecast(body);
    },
  };
}

async function requestUnknown(
  url: URL,
  label: string,
  context: ActionContext,
): Promise<unknown> {
  try {
    return await jsonRequest<unknown>(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      ctx: context,
    });
  } catch (raw) {
    if (context.signal.aborted) throw raw;
    if (raw instanceof ActionError && (raw.code === 429 || raw.code === 403)) {
      throw new ActionError(`Open-Meteo ${label} rate limit reached`, {
        displayMessage:
          "The public weather service is busy. Wait a moment, then try again.",
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError && raw.code === "BAD_RESPONSE") {
      throw new ActionError(`Open-Meteo ${label} returned non-JSON`, {
        displayMessage:
          "The weather service returned data this app does not understand. Check the API URL, then try again.",
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError && typeof raw.code === "number") {
      throw new ActionError(`Open-Meteo ${label} failed (${raw.code})`, {
        displayMessage: `The weather service could not complete this request (${raw.code}). Try again shortly.`,
        code: raw.code,
        cause: raw,
      });
    }
    if (raw instanceof ActionError && raw.code !== "NETWORK") throw raw;
    throw new ActionError(`Open-Meteo ${label} request failed`, {
      displayMessage:
        "Could not reach the weather service. Check your connection and API settings, then try again.",
      code: "NETWORK",
      cause: raw,
    });
  }
}

function parseLocations(value: unknown): LocationOption[] {
  try {
    const root = asRecord(value, "location response");
    if (root.results === undefined) return [];
    if (!Array.isArray(root.results)) {
      throw new TypeError("location response.results must be an array");
    }
    return root.results.map((item, index) => {
      const path = `location response.results[${index}]`;
      const record = asRecord(item, path);
      const latitude = readFiniteNumber(record, "latitude");
      const longitude = readFiniteNumber(record, "longitude");
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new TypeError(`${path} has invalid coordinates`);
      }
      const numericId = readFiniteNumber(record, "id");
      return {
        id: String(numericId),
        name: readNonEmptyString(record, "name"),
        country: readNonEmptyString(record, "country"),
        countryCode: readOptionalString(record, "country_code") ?? "",
        admin1: readOptionalString(record, "admin1"),
        latitude,
        longitude,
        timezone: readOptionalString(record, "timezone") ?? "auto",
      };
    });
  } catch (cause) {
    throw unexpectedResponse("location search", cause);
  }
}

function parseForecast(value: unknown): Forecast {
  try {
    const root = asRecord(value, "forecast response");
    const daily = asRecord(root.daily, "forecast response.daily");
    const units = asRecord(root.daily_units, "forecast response.daily_units");
    const dates = readStringArray(daily, "time");
    const weatherCodes = readNumberArray(daily, "weather_code");
    const maximums = readNumberArray(daily, "temperature_2m_max");
    const minimums = readNumberArray(daily, "temperature_2m_min");
    const rain = readNumberArray(daily, "precipitation_probability_max");
    const wind = readNumberArray(daily, "wind_speed_10m_max");
    const sunrise = readStringArray(daily, "sunrise");
    const sunset = readStringArray(daily, "sunset");
    const arrays = [weatherCodes, maximums, minimums, rain, wind, sunrise, sunset];
    if (dates.length === 0 || arrays.some((items) => items.length !== dates.length)) {
      throw new TypeError("forecast daily arrays must have the same non-zero length");
    }

    return {
      timezone: readNonEmptyString(root, "timezone"),
      temperatureUnit: readNonEmptyString(units, "temperature_2m_max"),
      windSpeedUnit: readNonEmptyString(units, "wind_speed_10m_max"),
      precipitationUnit: readNonEmptyString(
        units,
        "precipitation_probability_max",
      ),
      days: dates.map((date, index) => ({
        date,
        weatherCode: weatherCodes[index],
        temperatureMax: maximums[index],
        temperatureMin: minimums[index],
        precipitationProbability: rain[index],
        windSpeedMax: wind[index],
        sunrise: sunrise[index],
        sunset: sunset[index],
      })),
    };
  } catch (cause) {
    throw unexpectedResponse("forecast", cause);
  }
}

function unexpectedResponse(label: string, cause: unknown): ActionError {
  return new ActionError(`Open-Meteo returned an unexpected ${label} response`, {
    displayMessage:
      "The weather service returned data this app does not understand. Check the API URL, then try again.",
    code: "BAD_RESPONSE",
    cause,
  });
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${path} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new TypeError(`${key} must be a string`);
  return value;
}

function readFiniteNumber(
  record: Record<string, unknown>,
  key: string,
): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${key} must be a finite number`);
  }
  return value;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`);
  return value.map((item, index) => {
    if (typeof item !== "string" || item.length === 0) {
      throw new TypeError(`${key}[${index}] must be a non-empty string`);
    }
    return item;
  });
}

function readNumberArray(
  record: Record<string, unknown>,
  key: string,
): number[] {
  const value = record[key];
  if (!Array.isArray(value)) throw new TypeError(`${key} must be an array`);
  return value.map((item, index) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      throw new TypeError(`${key}[${index}] must be a finite number`);
    }
    return item;
  });
}

export function locationLabel(location: LocationOption): string {
  return [location.name, location.admin1, location.country]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(", ");
}
