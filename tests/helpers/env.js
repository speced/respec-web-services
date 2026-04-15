import os from "node:os";

// Set required env vars so modules that read them at load time don't throw.
process.env.GH_TOKEN = "test-token";
process.env.DATA_DIR = os.tmpdir();
