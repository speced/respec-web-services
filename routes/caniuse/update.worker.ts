import caniuseScraper from "./lib/scraper.ts";

interface Input {
  webhookId: string;
}

export default async function caniuseUpdate(_input: Input) {
  const updated = await caniuseScraper();
  return { updated };
}
