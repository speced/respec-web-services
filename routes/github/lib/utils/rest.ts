import fetch, { Response } from "node-fetch";
import { getToken, updateRateLimit, RateLimit } from "./tokens.js";

export async function* requestData(endpoint: string, pages = 30) {
  let url: string | null = endpoint;
  do {
    const token = getToken();
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `token ${token}`,
      },
    });

    if (!response.ok) {
      const { status: code, statusText: text } = response;
      throw new Error(`Failed to fetch ${url}. ${code} ${text}`);
    }

    const result = await response.json();
    yield { url, result };

    url = nextPage(response.headers.get("link") || "");
    updateRateLimit(token, getRateLimit(response.headers));
  } while (url !== null && --pages > 0);

  if (pages === 0 && url !== null) {
    const msg = `[gh/utils/rest@requestData]: Some pages were skipped.
    <${endpoint}>
      ➡ <${url}>
    ℹ Specify a larger value for \`pages\` argument.`;
    console.warn(msg);
  }
}

function nextPage(link: string) {
  const m = link.match(/<([^>]+)>\s*;\s*rel="next"/);
  return m ? m[1] : null;
}

function getRateLimit(headers: Response["headers"]): RateLimit {
  return {
    remaining: parseInt(headers.get("x-ratelimit-remaining") as string, 10),
    resetAt: new Date(parseInt(headers.get("x-ratelimit-reset") as string, 10)),
    limit: parseInt(headers.get("x-ratelimit-limit") as string, 10),
  };
}
