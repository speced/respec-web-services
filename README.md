# respec.org
ReSpec's website and RESTful API

https://respec.org

## Deploying

On the server, run `pnpm run server:update` to deploy: it pulls `main`, installs dependencies, and restarts the app.

Run `pnpm run server:start` the first time, and whenever `script` or `interpreter` in `ecosystem.config.cjs` changes. It re-registers the app with pm2, because `pnpm run server:restart` applies the rest of `ecosystem.config.cjs` but keeps the script and interpreter pm2 saved when the app was first started.

For local development, `pnpm dev` starts the server without first refreshing the data sources.
