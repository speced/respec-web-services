import unicodeScraper from "./lib/scraper.ts";

interface Input {}

export default async function unicodeUpdate(_input: Input) {
  const updated = await unicodeScraper();
  return { updated };
}
