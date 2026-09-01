import http from "node:http";
import { pathToFileURL } from "node:url";

export function createFixtureApi() {
  let forecastMode = "ok";

  return http.createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "accept, content-type");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/__control/forecast") {
      forecastMode = url.searchParams.get("mode") === "error" ? "error" : "ok";
      sendJson(response, 200, { forecastMode });
      return;
    }

    if (url.pathname === "/v1/search") {
      const query = (url.searchParams.get("name") ?? "").toLowerCase();
      if (query === "malformed") {
        sendJson(response, 200, { results: [{ id: 1, wrong: true }] });
        return;
      }
      if (query === "slow") {
        await delay(800);
        sendJson(response, 200, {
          results: [location(91, "Stale Slow Place", 44.1, 12.2, "Italy")],
        });
        return;
      }
      if (query.includes("syd")) {
        sendJson(response, 200, {
          results: [location(2, "Sydney", -33.8688, 151.2093, "Australia", "New South Wales")],
        });
        return;
      }
      if (query.includes("broken")) {
        sendJson(response, 200, {
          results: [location(3, "Broken Bay", -33.56, 151.29, "Australia", "New South Wales")],
        });
        return;
      }
      sendJson(response, 200, {
        results: [
          location(1, "Tokyo", 35.6762, 139.6503, "Japan", "Tokyo"),
          location(4, "Tokyo Bay", 35.5, 139.85, "Japan", "Chiba"),
        ],
      });
      return;
    }

    if (url.pathname === "/v1/forecast") {
      if (forecastMode === "error") {
        sendJson(response, 503, {
          message: "fixture details must not reach the screen",
          userMessage: "fixture server text must not be trusted",
        });
        return;
      }
      const latitude = Number(url.searchParams.get("latitude") ?? "35.6762");
      const locationName = latitude < 0 ? "Australia/Sydney" : "Asia/Tokyo";
      sendJson(response, 200, forecastFixture(locationName, latitude < 0 ? 4 : 0));
      return;
    }

    sendJson(response, 404, { message: "not found" });
  });
}

function location(id, name, latitude, longitude, country, admin1 = null) {
  return {
    id,
    name,
    latitude,
    longitude,
    country,
    country_code: country === "Japan" ? "JP" : country === "Australia" ? "AU" : "IT",
    admin1,
    timezone: country === "Japan" ? "Asia/Tokyo" : "Australia/Sydney",
  };
}

function forecastFixture(timezone, offset) {
  const dates = Array.from({ length: 7 }, (_, index) => `2026-09-${String(index + 2).padStart(2, "0")}`);
  const codes = [0, 2, 61, 3, 80, 45, 95].map((code, index) =>
    index === 0 && offset ? offset : code,
  );
  return {
    timezone,
    daily_units: {
      time: "iso8601",
      weather_code: "wmo code",
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
      precipitation_probability_max: "%",
      wind_speed_10m_max: "km/h",
      sunrise: "iso8601",
      sunset: "iso8601",
    },
    daily: {
      time: dates,
      weather_code: codes,
      temperature_2m_max: [29.4, 28.1, 25.2, 27.8, 24.6, 23.9, 26.3],
      temperature_2m_min: [21.2, 20.8, 19.9, 20.1, 18.7, 18.1, 19.2],
      precipitation_probability_max: [5, 15, 82, 25, 68, 12, 74],
      wind_speed_10m_max: [12.4, 14.2, 22.8, 11.6, 18.3, 8.9, 29.7],
      sunrise: dates.map((date, index) => `${date}T05:${String(18 + index).padStart(2, "0")}`),
      sunset: dates.map((date, index) => `${date}T18:${String(4 - Math.min(index, 4)).padStart(2, "0")}`),
    },
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.FIXTURE_PORT ?? "5209");
  createFixtureApi().listen(port, "127.0.0.1", () => {
    console.log(`fixture API: http://127.0.0.1:${port}/`);
  });
}
