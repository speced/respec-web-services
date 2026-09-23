import unicodeScraper from "./lib/scraper.ts";

type Input = Record<string, never>;

export default async function unicodeUpdate(_input: Input) {
  const updated = await unicodeScraper();
  return { updated };
}
