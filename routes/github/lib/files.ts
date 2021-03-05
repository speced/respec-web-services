import { requestData } from "./utils/graphql.js";
import { ms } from "../../../utils/misc.js";
import { DiskCache } from "../../../utils/disk-cache.js";

interface CacheEntry {
  files: string[];
  lastCommitAt: string;
}
const cache = new DiskCache<CacheEntry>({ ttl: ms("2h"), path: "gh/files" });

interface Options {
  /** Pass empty string for root directory */
  path: string;
  /** Git branch */
  branch: string;
  /** Recursive traversal depth */
  depth: number;
  /** Bypass cached data and fetch files anyway */
  noCache: boolean;
}

const defaulOptions: Options = {
  path: "",
  branch: "master",
  depth: 1,
  noCache: false,
};

/**
 * @param owner Repository owner/organization
 * @param name Repository name
 */
export async function getFiles(
  owner: string,
  name: string,
  options: Partial<Options>,
) {
  const opts = { ...defaulOptions, ...options };

  if (opts.noCache) {
    return await getFilesList(owner, name, opts);
  }

  const cacheKey = getCacheKey(owner, name, opts);

  // If cache has fresh data, return it.
  let cached = await cache.get(cacheKey, false);
  if (cached) {
    return cached.files;
  }

  // Find date of latest commit and compare it with stale cache data.
  // Pick from "stale" cache as there is no new commit.
  cached = await cache.get(cacheKey, true);
  const lastCommitAt = await getLatestCommitDate(owner, name, opts);
  if (cached && cached.lastCommitAt === lastCommitAt) {
    return cached.files;
  }

  // Otherwise, query for files and cache results.
  const files = await getFilesList(owner, name, opts);
  await cache.set(cacheKey, { lastCommitAt, files });
  return files;
}

function getCacheKey(owner: string, name: string, options: Options) {
  const { branch, path, depth } = options;
  return `${owner}/${name}/${branch}/${depth}/${path || "ROOT"}`;
}

async function getLatestCommitDate(owner: string, name: string, opts: Options) {
  const query = `
    query($owner: String!, $name: String!, $branch: String!, $path: String!) {
      repository(owner: $owner, name: $name) {
        ref(qualifiedName: $branch) {
          target {
            ... on Commit {
              history(first: 1, path: $path) {
                edges {
                  node {
                    committedDate
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  let { path, branch } = opts;
  if (path === "") path = ".";
  const variables = { owner, name, path, branch };

  const res = await requestData(query, variables);

  if (!res) {
    throw new Error("INTERNAL_ERROR");
  }
  if (!res.repository) {
    throw new Error("INVALID_REPOSITORY");
  }
  if (!res.repository.ref) {
    throw new Error("INVALID_BRANCH");
  }
  if (!res.repository.ref.target.history.edges.length) {
    throw new Error("INVALID_PATH");
  }

  const commit = res.repository.ref.target.history.edges[0].node;
  return commit.committedDate as string;
}

type TreeObject = {
  entries?:
    | { name: string; type: "blob" }[]
    | { name: string; type: "tree"; object: TreeObject }[];
};

interface GraphQLResponse {
  repository: null | { object: null | TreeObject };
}

async function getFilesList(owner: string, name: string, opts: Options) {
  const { depth, branch, path } = opts;

  const query = createQuery(depth);
  const expression = `${branch}:${path}`;
  const variables = { owner, name, expression };

  const response: GraphQLResponse = await requestData(query, variables);

  if (!response || !response.repository || !response.repository.object) {
    throw new Error("INTERNAL_ERROR");
  }

  const result: string[] = [];
  flattenFilesList(response.repository.object, result);
  return result;
}

function createQuery(depth = 1) {
  return `
    query($owner: String!, $name: String!, $expression: String!) {
      repository(owner: $owner, name: $name) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              name
              type
              ${createSubQuery(depth - 1)}
            }
          }
        }
      }
    }
  `;

  function createSubQuery(depth: number): string {
    if (depth < 1) return "";
    return `object {
      ... on Tree {
        entries { name, type, ${depth > 1 ? createSubQuery(depth - 1) : ""} }
      }
    }`;
  }
}

// Run a DFS to flatten the recursive TreeObject
function flattenFilesList(object: TreeObject, result: string[], dir = "") {
  if (!object || !object.entries) return;
  for (const entry of object.entries) {
    result.push(`${dir}${entry.name}`);
    if (entry.type === "tree") {
      result[result.length - 1] += "/";
      flattenFilesList(entry.object, result, `${dir}${entry.name}/`);
    }
  }
}
