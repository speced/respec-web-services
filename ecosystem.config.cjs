// @ts-check
"use strict";

/** @type {import("pm2").StartOptions} */
const app = {
  name: "respec.org",
  script: "./build/app.js",
  node_args: "--env-file-if-exists=.env --enable-source-maps",
  env_production: {
    NODE_ENV: "production",
  },
  max_memory_restart: "700M",
};

module.exports = { apps: [app] };
