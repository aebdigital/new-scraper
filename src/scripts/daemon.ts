/**
 * Eagle Eye scraper daemon (Node/tsx).
 *
 * Runs the discovery / crawl / enrich / azet loops forever. Launched by launchd
 * (com.eagleeye.scrapers) via `npm run daemon` — the SAME invocation shape as the
 * working web agent — so it survives Claude-session teardown, logout, and reboot.
 * (A bash script living inside ~/Documents is blocked by macOS TCC when launchd
 * execs it; running node via npm from /usr/local/bin is not, which is why this is
 * TS rather than a .sh.)
 *
 * Each loop has a crash guard: a batch that exits in under 30s triggers a 90s
 * cooldown so a transient failure can't spin the CPU.
 */
import { spawn } from "node:child_process";
import { mkdirSync, openSync, closeSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), "Library", "Logs", "eagle-eye");
mkdirSync(LOG_DIR, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const logLine = (name: string, msg: string) => {
  try {
    appendFileSync(join(LOG_DIR, `${name}.log`), msg + "\n");
  } catch {}
};

function runBatch(args: string[], logName: string): Promise<number> {
  return new Promise((resolve) => {
    logLine(logName, `\n===== ${logName} START ${new Date().toISOString()} =====`);
    // openSync gives a ready integer fd — spawn rejects a not-yet-open WriteStream.
    const fd = openSync(join(LOG_DIR, `${logName}.log`), "a");
    const done = (code: number) => {
      try {
        closeSync(fd);
      } catch {}
      resolve(code);
    };
    const p = spawn("npx", ["tsx", ...args], { stdio: ["ignore", fd, fd] });
    p.on("exit", (code) => done(code ?? 0));
    p.on("error", (e) => {
      logLine(logName, `[SPAWN ERROR] ${String(e)}`);
      done(1);
    });
  });
}

async function loop(name: string, ...batches: string[][]) {
  for (;;) {
    const start = Date.now();
    for (const args of batches) await runBatch(args, name);
    const durSec = (Date.now() - start) / 1000;
    if (durSec < 30) {
      logLine(name, `[GUARD] cycle exited in ${durSec.toFixed(0)}s — cooldown 90s`);
      await sleep(90_000);
    } else {
      await sleep(5_000);
    }
  }
}

// A stray error in one loop must not take the whole daemon down.
process.on("unhandledRejection", (e) => logLine("daemon", `[unhandledRejection] ${String(e)}`));
process.on("uncaughtException", (e) => logLine("daemon", `[uncaughtException] ${String(e)}`));

// Keep the Mac awake (lid open + plugged in still required).
spawn("caffeinate", ["-dimsu"], { stdio: "ignore" });

// Four independent loops running in parallel.
loop("discovery", ["src/scripts/discover-websites.ts", "--limit", "25000", "--delay", "700", "--concurrency", "6"]);
loop("crawl", ["src/scripts/run-crawl.ts", "--limit", "20000", "--concurrency", "8"]);
loop("enrich", ["src/scripts/enrich-contacts-from-websites.ts", "--limit", "60000"]);
loop(
  "azet",
  ["src/scripts/bulk-directory-match.ts", "harvest", "--max-pages", "5000", "--delay", "1200"],
  ["src/scripts/bulk-directory-match.ts", "profiles", "--limit", "15000", "--delay", "1200"],
  ["src/scripts/bulk-directory-match.ts", "match", "--limit", "80000", "--concurrency", "6"]
);

console.log(`[daemon] started ${new Date().toISOString()} — logs in ${LOG_DIR}`);
