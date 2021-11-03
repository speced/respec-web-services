import path from "path";
import { readFileSync } from "fs";

import fetch from "node-fetch";
import { Request, Response } from "express";

import { MemCache } from "../../utils/mem-cache.js";
import { env, ms, seconds, HTTPError } from "../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const dataSource = path.join(DATA_DIR, "w3c/groups.json");

export interface GroupMeta {
  id: number;
  name: string;
  URI: string;
}
type GroupType = "wg" | "cg" | "ig" | "bg" | "other";
export type Groups = Record<string, GroupMeta>;
export type GroupsByType = Record<GroupType, Groups>;

const groups: GroupsByType = JSON.parse(readFileSync(dataSource, "utf-8"));
const API_KEY = env("W3C_API_KEY");

interface Group {
  id: number;
  shortname: string;
  type: GroupType;
  name: string;
  URI?: string;
  patentURI?: string;
  patentPolicy?: "PP2017" | "PP2020" | null;
}
const cache = new MemCache<Group>(ms("1 day"));

// Support non W3C shortnames for backward compatibility.
const LEGACY_SHORTNAMES = new Map([
  ["wai-apa", "apa"],
  ["i18n", "i18n-core"], // more than 10 instances
]);

export default async function route(req: Request, res: Response) {
  const { shortname, type } = req.params;
  if (!shortname) {
    if (req.headers.accept?.includes("text/html")) {
      return res.render("w3c/groups.js", { groups });
    }
    return res.json(groups);
  }

  if (LEGACY_SHORTNAMES.has(shortname)) {
    return res.redirect(301, `/w3c/groups/${LEGACY_SHORTNAMES.get(shortname)}`);
  }

  if (type && !groups.hasOwnProperty(type)) {
    return res.status(404).send(`Invalid group type: "${type}".`);
  }
  try {
    const requestedType = type as GroupType;
    const groupInfo = await getGroupInfo(shortname, requestedType);
    res.set("Cache-Control", `max-age=${seconds("24h")}`);
    res.json(groupInfo);
  } catch (error) {
    const { statusCode, message } = error;
    res.set("Content-Type", "text/plain");
    res.status(statusCode).send(message);
  }
}

async function getGroupInfo(
  shortname: GroupMeta["name"],
  requestedType: GroupType,
) {
  const cacheKey = `${shortname}/${requestedType || ""}`;
  if (cache.expires(cacheKey) > 1000) {
    return cache.get(cacheKey);
  }

  const { id, type } = getGroupMeta(shortname, requestedType);
  const groupInfo = await fetchGroupInfo(id, shortname, type);

  cache.set(cacheKey, groupInfo);
  if (requestedType !== type) {
    cache.set(`${shortname}/${type}`, groupInfo);
  }
  return groupInfo;
}

async function fetchGroupInfo(
  id: GroupMeta["id"],
  shortname: GroupMeta["name"],
  type: GroupType,
) {
  const url = new URL(id.toString(), "https://api.w3.org/groups/");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url.href);
  if (!res.ok) {
    throw new HTTPError(res.status, res.statusText);
  }

  interface APIResponse {
    name: string;
    _links: Record<
      "homepage" | "pp-status" | "active-charter",
      { href: string }
    >;
  }
  const json = (await res.json()) as APIResponse;

  const { name, _links: links } = json;

  const patentPolicy = links["active-charter"]?.href
    ? await getPatentPolicy(links["active-charter"].href)
    : undefined;

  return {
    shortname,
    type,
    id,
    name,
    patentURI: links["pp-status"]?.href,
    patentPolicy,
    wgURI: `https://www.w3.org/groups/${type}/${shortname}`
  };
}

async function getPatentPolicy(
  activeCharterApiUrl: string,
): Promise<Required<Group["patentPolicy"]>> {
  const url = new URL(activeCharterApiUrl);
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url.href);
  const { ["patent-policy"]: patentPolicyURL } = (await res.json()) as {
    ["patent-policy"]?: string;
  };

  if (!patentPolicyURL || typeof patentPolicyURL !== "string") {
    return null;
  } else if (patentPolicyURL.includes("Patent-Policy-2017")) {
    return "PP2017";
  } else {
    return "PP2020";
  }
}

function getGroupMeta(shortname: string, requestedType: GroupType) {
  const types = requestedType
    ? [requestedType]
    : (Object.keys(groups) as GroupType[]);
  const data = types
    .filter(type => groups[type].hasOwnProperty(shortname))
    .map(type => {
      const id = groups[type][shortname].id;
      return { shortname, type, id };
    });

  switch (data.length) {
    case 1:
      return data[0];
    case 0: {
      const msg = `No group with shortname: "${shortname}"${
        requestedType ? ` and type: "${requestedType}"` : ""
      }.`;
      throw new HTTPError(404, msg);
    }
    default: {
      const msg = `Multiple groups with shortname: "${shortname}".`;
      const suggestions = data.map(g => `"${g.type}"`).join(", ");
      const hint = `Specify one of following group types: ${suggestions}.`;
      throw new HTTPError(409, `${msg}\n${hint}`);
    }
  }
}
