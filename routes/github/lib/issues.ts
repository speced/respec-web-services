import { requestData } from "./utils/graphql.js";
import { ms } from "../../../utils/misc.js";
import { DiskCache } from "../../../utils/disk-cache.js";

type IssueState = "OPEN" | "CLOSED";
type Label = { name: string; color: string };

interface GraphQLResponse {
  repository: {
    [issue: string]: {
      title: string;
      state: IssueState;
      bodyHTML: string;
      labels: {
        nodes: Label[];
      };
    };
  };
}

export interface Issue {
  title: string;
  state: IssueState;
  bodyHTML: string;
  labels: Label[];
}

const cache = new DiskCache<Issue>({ ttl: ms("12h"), path: "gh/issues" });

/**
 * @param owner Repository owner/organization
 * @param name Repository name
 * @param issues List of issue numbers to get details for
 */
export async function getIssues(owner: string, name: string, issues: number[]) {
  const result: { [issueNumber: string]: Issue | null } = {};
  const issuesToFetch = [];
  for (const issueNumber of issues) {
    const cacheKey = createCacheKey(owner, name, issueNumber);
    const cachedData = await cache.get(cacheKey);
    if (cachedData !== undefined) {
      result[issueNumber] = cachedData;
    } else {
      issuesToFetch.push(issueNumber);
    }
  }

  if (!issuesToFetch.length) return result;

  const query = createQuery(issuesToFetch);
  const response: GraphQLResponse = await requestData(query, { owner, name });
  if (!response.repository) {
    return null;
  }

  for (const [id, details] of Object.entries(response.repository)) {
    const issueNumber = antiAlias(id);
    if (!details) {
      result[issueNumber] = null;
    } else {
      const issue = { ...details, labels: details.labels.nodes };
      result[issueNumber] = issue;
    }
    const cacheKey = createCacheKey(owner, name, issueNumber);
    await cache.set(cacheKey, result[issueNumber]);
  }
  return result;
}

function createQuery(issues: number[]) {
  const subQueries = issues.map(
    issue => `${alias(issue)}: issue(number: ${issue}) { ...issue }`,
  );
  return `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        ${subQueries.join("\n        ")}
      }
    }
    fragment issue on Issue {
      title
      state
      bodyHTML
      labels(first: 10) {
        nodes {
          name
          color
        }
      }
    }`;
}

// sending number in GraphQL query alias isn't allowed
function alias(issue: number) {
  return `i${issue}`;
}

// opposite of alias
function antiAlias(id: string) {
  return parseInt(id.slice(1));
}

function createCacheKey(owner: string, name: string, issue: number) {
  return `${owner}/${name}/${issue}`;
}
