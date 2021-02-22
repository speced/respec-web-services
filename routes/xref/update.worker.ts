import xrefScraper from "./lib/scraper.js";

interface Input {
  webhookId: string;
}

export default async function xrefUpdate(_input: Input) {
  const updated = await xrefScraper();
  return { updated };
}
