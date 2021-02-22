import caniuseScraper from "./lib/scraper.js";

interface Input {
  webhookId: string;
}

export default async function caniuseUpdate(_input: Input) {
  const updated = await caniuseScraper();
  return { updated };
}
