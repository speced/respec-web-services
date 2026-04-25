import os from "node:os";

// Set required env vars only when not already configured,
// so local developer settings are preserved during test runs.
process.env.GH_TOKEN ||= "test-token";
process.env.DATA_DIR ||= os.tmpdir();
