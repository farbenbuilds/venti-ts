import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dockerArgs } from "./docker-args.ts";
import { exceedsInboundLimit } from "./expected-cases.ts";
import { AGENT, REPORTS_HOST_DIR, REPORT_INDEX_HOST_PATH } from "./paths.ts";
import { parseReportIndex, toCaseReports } from "./report-index.ts";
import type { CaseReport } from "./report-index.ts";

/// The report directory is wiped first so a stale `index.json` from an earlier
/// run can never be read as this run's evidence.
export function resetReportDirectory(): void {
  rmSync(REPORTS_HOST_DIR, { recursive: true, force: true });
  mkdirSync(REPORTS_HOST_DIR, { recursive: true });
}

function currentUser(): { readonly uid: string; readonly gid: string } {
  return { uid: String(process.getuid?.() ?? 1000), gid: String(process.getgid?.() ?? 1000) };
}

export function runFuzzingClient(): Promise<number> {
  const argv = dockerArgs(currentUser());
  return new Promise((resolve) => {
    const child = spawn("docker", argv, { stdio: "inherit" });
    child.once("error", (error) => {
      process.stderr.write(`autobahn: docker failed to start: ${error.message}\n`);
      resolve(127);
    });
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        process.stderr.write(`autobahn: wstest terminated by ${signal}\n`);
        resolve(128);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

export function reportExists(): boolean {
  return existsSync(REPORT_INDEX_HOST_PATH);
}

export function readReportCases(): readonly CaseReport[] {
  if (!reportExists()) {
    throw new Error(`autobahn: ${REPORT_INDEX_HOST_PATH} was not written by the suite`);
  }
  const raw = readFileSync(REPORT_INDEX_HOST_PATH, "utf8");
  return toCaseReports(parseReportIndex(raw, AGENT), exceedsInboundLimit);
}
