# respec.org
ReSpec's website and RESTful API

https://respec.org

## Deploying

On the server, run `pnpm run deploy:server`. It pulls `main`, installs dependencies, and re-registers the app with pm2 from `ecosystem.config.cjs`.

Use it instead of `pm2 restart respec.org`: a restart keeps the script and interpreter pm2 saved when the app was first started, so changes to `ecosystem.config.cjs` never take effect.
