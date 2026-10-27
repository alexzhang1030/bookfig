import { spawn, type ChildProcess } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const WEB = "http://127.0.0.1:43173";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
let started: ChildProcess | undefined;

export async function webUp(): Promise<boolean> {
  try {
    const res = await fetch(WEB, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForWeb(timeoutMs: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await webUp()) return;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Nuxt preview did not start on ${WEB}`);
}

/** Start Nuxt only if nothing is already serving :43173. Never kill it — two
 *  layout files share the port, and afterAll in one worker would brick the other. */
export async function ensureWeb(): Promise<void> {
  if (await webUp()) return;
  if (!started || started.exitCode !== null) {
    started = spawn("pnpm", ["--filter", "web", "dev"], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NUXT_TELEMETRY_DISABLED: "1" },
    });
  }
  await waitForWeb(80_000);
}
