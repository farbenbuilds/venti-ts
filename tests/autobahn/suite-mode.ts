import {
  CAPACITY_CASES,
  COMPRESSION_CASES,
  EVALUATED_CASES,
  SCALAR_CAPACITY_CASES,
  TOTAL_CASES,
} from "./expected-cases.ts";

/// How much of the suite a run selects, and the counts the gate holds it to.
///
/// The suite costs about four seconds a case and that cost is inside the Python
/// fuzzing client, not in the target: the target answers a connect, echo, and
/// close in 0.42 ms, so all 517 cases together are 0.2 seconds of target time
/// against 35 minutes of suite time. Nothing on this side can make the suite
/// faster, so the only lever is selecting fewer cases.
///
/// `framing` drops the two deflate groups. They are 216 of 517 cases, about
/// 42 per cent of the runtime, and every one of them is `UNIMPLEMENTED` because
/// `permessage-deflate` is normalised and never negotiated. They cannot change
/// until deflate is implemented, which will be its own change and can re-enable
/// them. `full` is the authoritative set and runs on the schedule.
export type SuiteMode = "framing" | "full";

export type ModeCounts = {
  readonly mode: SuiteMode;
  readonly total: number;
  readonly capacity: number;
  readonly evaluated: number;
  /// Baseline groups this mode selects, for the drift check.
  readonly groups: readonly string[];
};

/// The counts a run is held to, per selection.
const FRAMING_TOTAL = TOTAL_CASES - COMPRESSION_CASES;
const FRAMING_CAPACITY = SCALAR_CAPACITY_CASES;

export const MODE_COUNTS: Readonly<Record<SuiteMode, ModeCounts>> = {
  framing: {
    mode: "framing",
    total: FRAMING_TOTAL,
    capacity: FRAMING_CAPACITY,
    evaluated: FRAMING_TOTAL - FRAMING_CAPACITY,
    groups: ["1", "2", "3", "4", "5", "6", "7", "9", "10", "11"],
  },
  full: {
    mode: "full",
    total: TOTAL_CASES,
    capacity: CAPACITY_CASES,
    evaluated: EVALUATED_CASES,
    groups: ["1", "2", "3", "4", "5", "6", "7", "9", "10", "11", "12", "13"],
  },
};
