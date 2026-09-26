#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env
import { AUTOBAHN_IMAGE } from "./docker-args.ts";
import { AGENT, SUMMARY_HOST_PATH } from "./paths.ts";
import { probeTarget } from "./probe-echo.ts";
import type { EchoProbe } from "./probe-echo.ts";
import type { SuiteMode } from "./suite-mode.ts";
import { evaluateGate } from "./gate.ts";
import type { CaseReport } from "./report-index.ts";
import { buildSummary, formatSummary, writeSummary } from "./summary.ts";
import type { AutobahnSummary } from "./summary.ts";
import { readReportCases, reportExists, resetReportDirectory, runFuzzingClient } from "./suite.ts";
import { startTarget } from "./target-process.ts";
import type { TargetProcess } from "./target-process.ts";

// Deno runs this file; the capability set is the shebang, and `deno task
// autobahn` carries the same flags.
//
// The permissions are the reason this runs on Deno rather than Node. The harness
// spawns a WebSocket server, spawns Docker, reads and writes a report directory,
// and reads two environment variables, and it needs nothing else. Under Node
// there is no equivalent, so a bug here has the whole filesystem.
//
// It uses Deno's `node:` compatibility surface rather than rewriting every call
// to `Deno.Command` and friends. That is deliberate: it keeps the harness under
// the repository's existing `tsc`, `oxlint`, `oxfmt`, and 150-line gates, so
// there is one typechecker and one formatter for the whole tree, and it keeps the
// addon load on the `createRequire` path that `tests/binding/**` already
// exercises under Node. Deno gates `node:child_process` behind `--allow-run` all
// the same, so the permission model is intact either way.
type RunOptions = {
  readonly help: boolean;
  readonly force: boolean;
  readonly mode: SuiteMode;
};

const USAGE = [
  "usage: deno task autobahn [--full] [--force]",
  "",
  "Starts tests/autobahn/target.ts, measures whether it can echo, and runs the",
  "digest-pinned Autobahn fuzzing client against it. The report and a",
  "machine-readable summary are written on every exit path.",
  "",
  "  --full   select all 517 cases, including the per-message-deflate groups.",
  "           The default, framing, omits those two groups: they are 216 cases",
  "           of UNIMPLEMENTED because deflate is never negotiated, and the",
  "           suite costs about four seconds a case inside the Python client.",
  "  --force  run the fuzzing client even when the probe shows the target",
  "           cannot echo, so a failing run still captures suite evidence",
].join("\n");

function parseOptions(argv: readonly string[]): RunOptions {
  const known = new Set(["--force", "--help", "--full"]);
  for (const arg of argv) {
    if (!known.has(arg)) throw new RangeError(`unknown argument ${arg}; run with --help`);
  }
  return {
    help: argv.includes("--help"),
    force: argv.includes("--force"),
    mode: argv.includes("--full") ? "full" : "framing",
  };
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
    const code = await runFuzzingClient(options.mode);
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
  const gate = execution.cases.length === 0 ? null : evaluateGate(execution.cases, options.mode);
  const ok = execution.failure === null && gate !== null && gate.ok;
  return buildSummary({
    ok,
    mode: options.mode,
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
