import { requestData } from "./utils/graphql.js";
import { ms } from "../../../utils/misc.js";
import { DiskCache } from "../../../utils/disk-cache.js";

export interface Commit {
  messageHeadline: string;
  abbreviatedOid: string;
  committedDate: string;
}

interface HistoryResponse {
  repository: {
    object: {
      history: {
        nodes: Commit[];
        pageInfo: {
          endCursor: string;
          hasNextPage: boolean;
        };
      };
    };
  };
}

interface CacheEntry {
  commits: Commit[];
  since: string;
}

const cache = new DiskCache<CacheEntry>({ ttl: ms("15d"), path: "gh/commits" });

/**
 * Get commits since given commitish
 * @param org repository owner/organization
 * @param repo repository name
 * @param fromRef commitish
 * @param toRef commitish
 * @example
 * ```
 * for await (const commit of getCommits('w3c', 'respec', 'HEAD~5', 'HEAD~2')) {
 *   console.log(commit);
 * }
 * ```
 */
export async function* getCommits(
  org: string,
  repo: string,
  fromRef: string,
  toRef = "HEAD",
  path?: string
) {
  const cacheKey = path ? `${org}/${repo}/${path}@${fromRef}..${toRef}` : `${org}/${repo}@${fromRef}..${toRef}`;
  const cached = await cache.get(cacheKey);
  const { since, commits } = cached || {
    since: await getCommitDate(org, repo, fromRef),
    commits: [],
  };

  // immediately send out cached items
  yield* commits;

  const newCacheEntry = { since: "", commits };
  let cursor: string | undefined;
  do {
    const data = await getCommitsSince(org, repo, since, toRef, cursor, path);
    yield* data.commits;
    cursor = data.cursor;

    // to update cache
    if (data.commits && data.commits.length) {
      newCacheEntry.commits.push(...data.commits);
      if (newCacheEntry.since === "") {
        const HEAD = data.commits[0];
        newCacheEntry.since = HEAD.committedDate;
      }
    }
  } while (!!cursor);

  const hasNewData = !cached || newCacheEntry.since !== cached.since;
  if (hasNewData && newCacheEntry.since !== "") {
    await cache.set(cacheKey, newCacheEntry);
  }
}

async function getCommitDate(org: string, repo: string, ref: string) {
  const query = `
    query($org: String!, $repo: String!, $ref: String!) {
      repository(owner: $org, name: $repo) {
        object(expression: $ref) {
          ... on Commit {
            history(first: 1) {
              nodes {
                committedDate
              }
            }
          }
        }
      }
    }
  `;

  const data = await requestData(query, { org, repo, ref });
  const repository: HistoryResponse["repository"] | null = data.repository;
  if (repository === null) {
    throw new Error("Cannot find given repository");
  }
  try {
    return repository.object.history.nodes[0].committedDate;
  } catch {
    throw new Error("Cannot query `since` date using given ref");
  }
}

async function getCommitsSince(
  org: string,
  repo: string,
  since: string,
  toRef: string,
  cursor?: string,
  path?: string,
) {
  const query = `
    query(
      $org: String!
      $repo: String!
      $since: GitTimestamp!
      $toRef: String!
      $cursor: String
      $path: String
    ) {
      repository(owner: $org, name: $repo) {
        object(expression: $toRef) {
          ... on Commit {
            history(since: $since, after: $cursor, path: $path) {
              nodes {
                messageHeadline
                abbreviatedOid
                committedDate
              }
              pageInfo {
                endCursor
                hasNextPage
              }
            }
          }
        }
      }
    }
  `;

  const variables = { org, repo, since, toRef, cursor, path };
  const { repository } = await requestData<HistoryResponse>(query, variables);

  const { nodes: commits, pageInfo } = repository.object.history;
  // skip the commit referencing "ref" (on last page)
  if (!pageInfo.hasNextPage) commits.pop();
  return {
    commits,
    cursor: pageInfo.hasNextPage ? pageInfo.endCursor : undefined,
  };
}
