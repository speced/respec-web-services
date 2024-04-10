import fetch from "node-fetch";
import { getToken, updateRateLimit, RateLimit } from "./tokens.js";

const ENDPOINT = "https://api.github.com/graphql";

const rateLimitQuery = `
  _rateLimit: rateLimit {
    remaining
    resetAt
    limit
  }
`;

const getFullQuery = (query: string) => {
  return query.replace("{", `{${rateLimitQuery}`);
};

type Json = Record<string, any>;
export async function requestData<T = Json>(query: string, variables?: object) {
  const body = { query: getFullQuery(query), variables };
  const token = getToken();
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  type GraphqlResponse<T> = { data: T & { _rateLimit: RateLimit } };
  const json = (await response.json()) as GraphqlResponse<T>;

  const { _rateLimit, ...data } = json.data;

  _rateLimit.resetAt = new Date(_rateLimit.resetAt);
  updateRateLimit(token, _rateLimit);

  return data as unknown as T;
}
