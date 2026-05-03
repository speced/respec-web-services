import baselineScraper from "./lib/scraper.js";

interface Input {
  webhookId: string;
}

export default async function baselineUpdate(_input: Input) {
  const updated = await baselineScraper();
  return { updated };
}
