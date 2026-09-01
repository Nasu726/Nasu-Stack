import type { Action, ActionContext } from "@/lib/action";
import { ActionError } from "@/lib/action";
import type { LocationOption } from "@/lib/weather";

export const ACTIVITY_OPTIONS = [
  { value: "flexible", label: "Stay flexible" },
  { value: "outdoors", label: "Outdoor time" },
  { value: "errands", label: "Errands" },
  { value: "rest", label: "Rest day" },
] as const;

export type Activity = (typeof ACTIVITY_OPTIONS)[number]["value"];

export interface DayPlan {
  activity: Activity;
  note: string;
}

export interface PlannerDraft {
  version: 1;
  location: LocationOption;
  plans: Record<string, DayPlan>;
}

export interface SavedDraft {
  savedAt: number;
}

export interface RestoredDraft {
  draft: PlannerDraft;
  restored: boolean;
}

export const STORAGE_KEY = "nasu-stack.weather-planner.v1";

export function emptyDraft(location: LocationOption): PlannerDraft {
  return { version: 1, location, plans: Object.create(null) };
}

export function readPlannerDraft(defaultLocation: LocationOption): RestoredDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { draft: emptyDraft(defaultLocation), restored: false };
    const value: unknown = JSON.parse(raw);
    return { draft: parseDraft(value), restored: true };
  } catch {
    // A stale/corrupt local value must not stop the app from starting.
    return { draft: emptyDraft(defaultLocation), restored: false };
  }
}

export const savePlannerDraft: Action<PlannerDraft, SavedDraft> = async (
  draft,
  context,
) => {
  await abortableDelay(180, context);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (cause) {
    throw new ActionError("Could not write planner draft to localStorage", {
      displayMessage:
        "This browser could not save your plan. Check storage permissions, then try again.",
      code: "LOCAL_STORAGE",
      cause,
    });
  }
  return { savedAt: Date.now() };
};

function abortableDelay(milliseconds: number, context: ActionContext) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      context.signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    context.signal.addEventListener("abort", onAbort, { once: true });
  });
}

function parseDraft(value: unknown): PlannerDraft {
  const root = asRecord(value, "draft");
  if (root.version !== 1) throw new TypeError("draft.version is unsupported");
  const location = parseLocation(root.location);
  const plansRecord = asRecord(root.plans, "draft.plans");
  const plans: Record<string, DayPlan> = Object.create(null);
  for (const [date, rawPlan] of Object.entries(plansRecord)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new TypeError("draft plan keys must be ISO dates");
    }
    const plan = asRecord(rawPlan, `draft.plans.${date}`);
    const activity = plan.activity;
    const note = plan.note;
    if (!ACTIVITY_OPTIONS.some((option) => option.value === activity)) {
      throw new TypeError(`draft.plans.${date}.activity is invalid`);
    }
    if (typeof note !== "string" || note.length > 240) {
      throw new TypeError(`draft.plans.${date}.note is invalid`);
    }
    plans[date] = { activity: activity as Activity, note };
  }
  return { version: 1, location, plans };
}

function parseLocation(value: unknown): LocationOption {
  const location = asRecord(value, "draft.location");
  const latitude = finiteNumber(location.latitude, "draft.location.latitude");
  const longitude = finiteNumber(location.longitude, "draft.location.longitude");
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new TypeError("draft.location coordinates are invalid");
  }
  return {
    id: nonEmptyString(location.id, "draft.location.id"),
    name: nonEmptyString(location.name, "draft.location.name"),
    country: nonEmptyString(location.country, "draft.location.country"),
    countryCode: optionalString(location.countryCode, "draft.location.countryCode") ?? "",
    admin1: optionalString(location.admin1, "draft.location.admin1"),
    latitude,
    longitude,
    timezone: nonEmptyString(location.timezone, "draft.location.timezone"),
  };
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

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${path} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new TypeError(`${path} must be a string`);
  return value;
}

function finiteNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number`);
  }
  return value;
}
