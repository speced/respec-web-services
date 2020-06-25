const fetch = require("node-fetch").default;

const BASE_URL = "https://respec.org";

async function run() {
  const endpoints = process.env.ENDPOINTS.trim().split("\n");
  const urls = endpoints.map(s => {
    const url = new URL(s, BASE_URL);
    url.searchParams.append("healthcheck", "true");
    return url;
  });

  const failures = [];
  for (const url of urls) {
    try {
      console.log(`${url.href} ... `);
      const res = await fetch(url.href, { method: "HEAD" });
      console.log(`\tOK`);
      if (!res.ok) {
        failures.push({ url: url.pathname, status: res.status });
      }
    } catch (error) {
      console.log(`\tERROR: ${error.message}`);
      failures.push({ url: url.pathname, status: `[${error.code}]` });
    }
  }

  if (!failures.length) return;
  const text = failures
    .map(({ url, status }) => `🔴 HEAD ${status} ${url}`)
    .join("\n");

  console.log(`Reporting ${failures.length} failures on Slack... `);
  const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  console.log(res.ok ? "\tOK" : `\tFAILED (${res.status})`);
  process.exit(1);
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
