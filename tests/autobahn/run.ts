import { AUTOBAHN_IMAGE } from "./docker-args.ts";
import { AGENT, SUMMARY_HOST_PATH } from "./paths.ts";
import { probeTarget } from "./probe-echo.ts";
import type { EchoProbe } from "./probe-echo.ts";
import { evaluateGate } from "./gate.ts";
import type { CaseReport } from "./report-index.ts";
import { buildSummary, formatSummary, writeSummary } from "./summary.ts";
import type { AutobahnSummary } from "./summary.ts";
import { readReportCases, reportExists, resetReportDirectory, runFuzzingClient } from "./suite.ts";
import { startTarget } from "./target-process.ts";
import type { TargetProcess } from "./target-process.ts";

type RunOptions = {
  readonly help: boolean;
  readonly force: boolean;
};

const USAGE = [
  "usage: node tests/autobahn/run.ts [--force]",
  "",
  "Starts tests/autobahn/target.ts, measures whether it can echo, and runs the",
  "digest-pinned Autobahn fuzzing client against it. The report and a",
  "machine-readable summary are written on every exit path.",
  "",
  "  --force  run the fuzzing client even when the probe shows the target",
  "           cannot echo, so a failing run still captures suite evidence",
].join("\n");

function parseOptions(argv: readonly string[]): RunOptions {
  const known = new Set(["--force", "--help"]);
  for (const arg of argv) {
    if (!known.has(arg)) throw new RangeError(`unknown argument ${arg}; run with --help`);
  }
  return { help: argv.includes("--help"), force: argv.includes("--force") };
}

type Execution = {
  readonly probe: EchoProbe | null;
  readonly suiteRun: boolean;
  readonly cases: readonly CaseReport[];
  readonly failure: string | null;
};

async function probeAndRun(options: RunOptions, target: TargetProcess): Promise<Execution> {
  const probe = await probeTarget({
    port: target.ready.port,
    engine: target.ready.engine,
    inboundLimitBytes: target.ready.maxMessageBytes,
  });
  if (probe.echo || options.force) {
    const code = await runFuzzingClient();
    if (!reportExists()) {
      return { probe, suiteRun: true, cases: [], failure: `wstest wrote no report (exit ${code})` };
    }
    return {
      probe,
      suiteRun: true,
      cases: readReportCases(),
      failure: code === 0 ? null : `wstest exited with code ${code}`,
    };
  }
  return {
    probe,
    suiteRun: false,
    cases: [],
    failure:
      `target on port ${target.ready.port} cannot echo (${probe.detail}); ` +
      "the suite would only record timeouts. Re-run with --force to capture " +
      "that evidence anyway.",
  };
}

async function execute(options: RunOptions): Promise<AutobahnSummary> {
  resetReportDirectory();
  let target: TargetProcess | null = null;
  let execution: Execution = { probe: null, suiteRun: false, cases: [], failure: null };
  try {
    target = await startTarget();
    execution = await probeAndRun(options, target);
  } catch (error) {
    execution = { ...execution, failure: (error as Error).message };
  }
  if (target !== null) await target.stop();
  const gate = execution.cases.length === 0 ? null : evaluateGate(execution.cases);
  const ok = execution.failure === null && gate !== null && gate.ok;
  return buildSummary({
    ok,
    agent: AGENT,
    image: AUTOBAHN_IMAGE,
    target: execution.probe,
    suiteRun: execution.suiteRun,
    gate,
    cases: execution.cases,
    failure: execution.failure,
  });
}

async function main(argv: readonly string[]): Promise<number> {
  let options: RunOptions;
  try {
    options = parseOptions(argv);
  } catch (error) {
    process.stderr.write(`autobahn: ${(error as Error).message}\n${USAGE}\n`);
    return 2;
  }
  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  // The target process module owns the signal handlers, so an interrupted run
  // reaps the child before this process exits.
  const summary = await execute(options);
  writeSummary(SUMMARY_HOST_PATH, summary);
  process.stdout.write(`${formatSummary(summary)}\n`);
  return summary.ok ? 0 : 1;
}

process.exitCode = await main(process.argv.slice(2));
