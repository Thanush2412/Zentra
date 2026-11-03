/**
 * Standardized Shift Configuration Defaults
 * Single source of truth for Shift 1, Shift 2, and General Shift parameter templates.
 */

import type { ShiftParams } from "./utils";

export const DEFAULT_SHIFT_CONFIGS: Record<"shift_1" | "shift_2" | "general", ShiftParams> = {
  shift_1: {
    label: "Shift 1",
    startTime: "08:30 AM",
    periodDuration: 50,
    periodsCount: 5,
    mode: "duration",
    breaks: []
  },
  shift_2: {
    label: "Shift 2",
    startTime: "01:00 PM",
    periodDuration: 50,
    periodsCount: 5,
    mode: "duration",
    breaks: []
  },
  general: {
    label: "General Shift",
    startTime: "09:00 AM",
    periodDuration: 50,
    periodsCount: 6,
    mode: "duration",
    breaks: []
  }
};
