// @ts-check
"use strict";

/** @type {import("pm2").StartOptions} */
const app = {
  name: "respec.org",
  script: "./app.ts",
  interpreter: "node",
  node_args: "--env-file-if-exists=.env",
  env_production: {
    NODE_ENV: "production",
    FORCE_COLOR: "1",
  },
  max_memory_restart: "700M",
};

module.exports = { apps: [app] };
