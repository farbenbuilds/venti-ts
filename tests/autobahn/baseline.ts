import baseline from "./baseline.json" with { type: "json" };

/// The known-failing case set, as committed in `baseline.json`.
///
/// The engine has never passed this suite, so a gate that demanded all 389
/// evaluated cases would be red on arrival and would tell a contributor nothing
/// except that the job is red. A known-failure list is the honest alternative:
/// the gate still fails the moment a case outside the list fails, so a regression
/// cannot hide, and it reports any listed case that starts passing so the list
/// can only shrink. Nothing is excluded from the report; every case is still
/// classified and printed.
export type Baseline = {
  readonly size: number;
  readonly has: (id: string) => boolean;
  readonly groups: readonly {
    readonly group: string;
    readonly reason: string;
    readonly count: number;
  }[];
};

type BaselineGroup = {
  readonly reason: string;
  /// Space-separated case identifiers, one group per entry. The file is a data
  /// list rather than prose, so it is kept compact enough to read at a glance.
  readonly cases: string;
};

const GROUPS: Readonly<Record<string, BaselineGroup>> = baseline.groups;
const IDS: ReadonlySet<string> = new Set(
  Object.values(GROUPS).flatMap((group) => group.cases.split(" ")),
);

export const ALL_BASELINE_IDS: readonly string[] = [...IDS].sort();

export const KNOWN_FAILURES: Baseline = {
  size: IDS.size,
  has: (id: string): boolean => IDS.has(id),
  groups: Object.entries(GROUPS)
    .map(([group, value]) => ({
      group,
      reason: value.reason,
      count: value.cases.split(" ").length,
    }))
    .sort((left, right) => left.group.localeCompare(right.group)),
};
