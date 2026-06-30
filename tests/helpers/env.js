import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Fake credentials for tests. Use ||= so a developer's real values win.
process.env.GH_TOKEN ||= "test-token";
process.env.RESPEC_GH_ACTION_SECRET ||= "test-secret-key-12345";

// Give the whole test run an isolated, throwaway DATA_DIR so tests that read or
// write under it never touch a developer's real data, and reproduce regardless
// of the local environment. Set unconditionally and removed when the process
// exits.
const dataDir = mkdtempSync(path.join(os.tmpdir(), "rws-test-"));
process.env.DATA_DIR = dataDir;
process.on("exit", () => rmSync(dataDir, { recursive: true, force: true }));
