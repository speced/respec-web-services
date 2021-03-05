import { requestData } from "./utils/rest.js";
import { ms } from "../../../utils/misc.js";
import { DiskCache } from "../../../utils/disk-cache.js";

export interface Contributor {
  login: string;
  contributions: number;
}

export const cache = new DiskCache<Contributor[]>({
  ttl: ms("7d"),
  path: "gh/contributors",
});

const getAPIURL = (owner: string, repo: string) =>
  new URL(`https://api.github.com/repos/${owner}/${repo}/contributors`).href;

/**
 * Gets GitHub login names and number of contributions of all the contributors
 * to a particular repo
 * @param owner organisation/user, e.g. `"w3c"`
 * @param repo repository name, e.g. `"payment-request"`
 */
export async function* getContributors(owner: string, repo: string) {
  const cacheKey = `${owner}/${repo}`;
  const resultFromCache = await cache.get(cacheKey);
  if (resultFromCache !== undefined) {
    yield* resultFromCache;
    return;
  }

  const allContributers: Contributor[] = [];
  const endpoint = getAPIURL(owner, repo);
  for await (const { result: contributors } of requestData(endpoint)) {
    for (const { login, contributions } of contributors as Contributor[]) {
      const contributor = { login, contributions };
      yield contributor;
      allContributers.push(contributor);
    }
  }

  await cache.set(cacheKey, allContributers);
}
