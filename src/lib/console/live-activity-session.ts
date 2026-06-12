import type { LiveActivityLogEntry } from "@/components/console/live-activity/live-activity-types";
import { PRESENTATION_AUM_BASE_PHP } from "@/lib/console/live-activity-format";

export interface LiveActivitySessionState {
  logs: LiveActivityLogEntry[];
  aumPhp: number;
  sessionPnlUsd: number;
  seenInvestmentKeys: Set<string>;
  botNameIndex: number;
  rngSeed: number;
  investmentsInitialized: boolean;
  aumTickFlash: boolean;
}

function createInitialState(): LiveActivitySessionState {
  return {
    logs: [],
    aumPhp: PRESENTATION_AUM_BASE_PHP,
    sessionPnlUsd: 0,
    seenInvestmentKeys: new Set(),
    botNameIndex: 0,
    rngSeed: Date.now() % 2147483646,
    investmentsInitialized: false,
    aumTickFlash: false,
  };
}

let state: LiveActivitySessionState = createInitialState();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getLiveActivitySession(): LiveActivitySessionState {
  return state;
}

export function subscribeLiveActivitySession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetLiveActivitySession(): void {
  state = createInitialState();
  emit();
}

export function patchLiveActivitySession(
  patch: Partial<Omit<LiveActivitySessionState, "seenInvestmentKeys">> & {
    seenInvestmentKeys?: Set<string>;
  }
): void {
  state = { ...state, ...patch };
  emit();
}

export function updateLiveActivitySession(
  updater: (prev: LiveActivitySessionState) => LiveActivitySessionState
): void {
  state = updater(state);
  emit();
}
