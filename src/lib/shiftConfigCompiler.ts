/**
 * Campus shift-config compiler (hook-free so the wizard, tests and the
 * headless harness can all call it).
 *
 * `colleges.shift_configs` is read in three different shapes by the portals:
 * the top-level `shift_1/shift_2/general` period arrays (L&D grid, slot
 * pickers), `custom_shift_params` (period maths in utils.ts) and
 * `semester_configs`, which AppContext exposes as `semesters` so a semester
 * can override the campus default. Writing only `custom_shift_params` leaves
 * the other two empty and every consumer silently falls back to the standard
 * SHIFT_TIME_SLOTS.
 */

import { calculateShiftSchedule, type ShiftParams } from "./utils";

export type ShiftKey = "shift_1" | "shift_2" | "general";

export type ShiftParamsTriple = Record<ShiftKey, ShiftParams>;

export type SemesterParamsMap = Record<string, ShiftParamsTriple>;

export interface CompiledSemesterConfig {
  shift_1: string[];
  shift_2: string[];
  general: string[];
  custom_shift_params: ShiftParamsTriple;
}

export interface CompiledShiftConfigs {
  shift_1: string[];
  shift_2: string[];
  general: string[];
  custom_shift_params: ShiftParamsTriple;
  semester_configs: Record<string, CompiledSemesterConfig>;
}

export type CompileOutcome =
  | { ok: true; configs: CompiledShiftConfigs; errors: [] }
  | { ok: false; configs: null; errors: string[] };

/** Map key for the campus-wide fallback every other semester inherits from. */
export const ALL_SEMESTERS_KEY = "All Semesters";

const SHIFT_KEYS: ShiftKey[] = ["shift_1", "shift_2", "general"];

const SHIFT_ERROR_LABELS: Record<ShiftKey, string> = {
  shift_1: "Shift 1",
  shift_2: "Shift 2",
  general: "General Shift"
};

export function cloneShiftParams(triple: ShiftParamsTriple): ShiftParamsTriple {
  const clone = (params: ShiftParams): ShiftParams => ({
    ...params,
    breaks: (params.breaks ?? []).map(br => ({ ...br }))
  });
  return {
    shift_1: clone(triple.shift_1),
    shift_2: clone(triple.shift_2),
    general: clone(triple.general)
  };
}

function compileTriple(
  semester: string,
  triple: ShiftParamsTriple,
  hasShifts: boolean,
  errors: string[]
): CompiledSemesterConfig | null {
  const schedules: Record<ShiftKey, ReturnType<typeof calculateShiftSchedule>> = {
    shift_1: calculateShiftSchedule(triple.shift_1),
    shift_2: calculateShiftSchedule(triple.shift_2),
    general: calculateShiftSchedule(triple.general)
  };

  for (const key of SHIFT_KEYS) {
    // Without shifts the campus only ever runs the general schedule.
    if (key !== "general" && !hasShifts) continue;
    const error = schedules[key].error;
    if (error) errors.push(`${semester} - ${SHIFT_ERROR_LABELS[key]}: ${error}`);
  }

  if (errors.length > 0) return null;

  const periodsOf = (key: ShiftKey) =>
    schedules[key].items
      .filter(item => item.type === "period")
      .map(item => `${item.startTimeStr} - ${item.endTimeStr}`);

  return {
    shift_1: periodsOf("shift_1"),
    shift_2: periodsOf("shift_2"),
    general: periodsOf("general"),
    custom_shift_params: cloneShiftParams(triple)
  };
}

export function compileShiftConfigs(
  allSemestersParams: ShiftParamsTriple,
  semesterParamsMap: SemesterParamsMap,
  hasShifts: boolean
): CompileOutcome {
  const errors: string[] = [];

  const base = compileTriple(ALL_SEMESTERS_KEY, allSemestersParams, hasShifts, errors);
  if (!base) return { ok: false, configs: null, errors };

  const semester_configs: Record<string, CompiledSemesterConfig> = {};

  for (const semester of Object.keys(semesterParamsMap)) {
    if (semester === ALL_SEMESTERS_KEY) continue;
    const semesterErrors: string[] = [];
    const compiled = compileTriple(semester, semesterParamsMap[semester], hasShifts, semesterErrors);
    if (!compiled) {
      errors.push(...semesterErrors);
      continue;
    }
    semester_configs[semester] = compiled;
  }

  if (errors.length > 0) return { ok: false, configs: null, errors };

  return {
    ok: true,
    errors: [],
    configs: {
      shift_1: base.shift_1,
      shift_2: base.shift_2,
      general: base.general,
      custom_shift_params: cloneShiftParams(allSemestersParams),
      semester_configs
    }
  };
}

/**
 * Rebuilds the editable per-semester parameter map from a stored
 * `shift_configs` blob. `custom_shift_params` is the All-Semesters triple, so
 * a legacy campus saved without `semester_configs` hydrates with no overrides.
 */
export function semesterParamsMapFromShiftConfigs(
  shiftConfigs: string | null | undefined
): SemesterParamsMap {
  if (!shiftConfigs) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(shiftConfigs);
  } catch {
    return {};
  }

  const stored = (parsed as {
    semester_configs?: Record<string, { custom_shift_params?: Partial<ShiftParamsTriple> }>;
  }).semester_configs;
  if (!stored) return {};

  const map: SemesterParamsMap = {};
  for (const semester of Object.keys(stored)) {
    if (semester === ALL_SEMESTERS_KEY) continue;
    const params = stored[semester]?.custom_shift_params;
    if (params?.shift_1 && params.shift_2 && params.general) {
      map[semester] = cloneShiftParams(params as ShiftParamsTriple);
    }
  }
  return map;
}
