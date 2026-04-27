import path from "path";
import { readFileSync, existsSync } from "fs";

import { Request, Response } from "express";

import { MemCache } from "../../utils/mem-cache.js";
import { env, ms, seconds, HTTPError } from "../../utils/misc.js";

async function update() {
  const { default: updateGroupsList } = await import("../../scripts/update-w3c-groups-list.js");
  return updateGroupsList();
}
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


let groups: GroupsByType;
try {
  groups = existsSync(dataSource)
    ? JSON.parse(readFileSync(dataSource, "utf-8"))
    : { wg: {}, cg: {}, ig: {}, bg: {}, other: {} };
} catch (error) {
  console.error("Failed to parse groups.json at startup:", error);
  groups = { wg: {}, cg: {}, ig: {}, bg: {}, other: {} };
  void refreshGroups();
  void refreshGroups();
}

interface Group {
  id: number;
  shortname: string;
  type: GroupType;
  name: string;
  wgURI: string;
  URI?: string;
  patentURI?: string;
  patentPolicy?: "PP2017" | "PP2020" | null;
}
const cache = new MemCache<Group>(ms("1 day"));

function reloadGroups() {
  try {
    if (existsSync(dataSource)) {
      groups = JSON.parse(readFileSync(dataSource, "utf-8"));
      cache.clear();
    }
  } catch (error) {
    console.error("Failed to reload groups.json:", error);
  }
}

let refreshing = false;
async function refreshGroups() {
  if (refreshing) return;
  refreshing = true;
  try {
    await update();
    reloadGroups();
    console.log("W3C groups list refreshed.");
  } catch (error) {
    console.error("Failed to refresh W3C groups:", error);
  } finally {
const GROUPS_REFRESH_INTERVAL_MS = ms("24h");
const GROUPS_REFRESH_RETRY_MS = ms("15m");

async function refreshGroups(): Promise<boolean> {
  try {
    await update();
    reloadGroups();
    if (!existsSync(dataSource)) {
      console.error(
        "Failed to refresh W3C groups: groups.json is still missing after update."
      );
      return false;
    }
    console.log("W3C groups list refreshed.");
    return true;
  } catch (error) {
    console.error("Failed to refresh W3C groups:", error);
    return false;
  }
}

function scheduleGroupsRefresh(delay: number) {
  setTimeout(async () => {
    const refreshed = await refreshGroups();
    const nextDelay =
      refreshed || existsSync(dataSource)
        ? GROUPS_REFRESH_INTERVAL_MS
        : GROUPS_REFRESH_RETRY_MS;
    scheduleGroupsRefresh(nextDelay);
  }, delay);
}

scheduleGroupsRefresh(existsSync(dataSource) ? GROUPS_REFRESH_INTERVAL_MS : 0);

// Support non W3C shortnames for backward compatibility.
const LEGACY_SHORTNAMES = new Map([
  ["wai-apa", "apa"],
  ["i18n", "i18n-core"], // more than 10 instances
]);

type Params = { shortname?: string; type?: string };
type IRequest = Request<Params>;

export default async function route(req: IRequest, res: Response) {
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
    res.set("Content-Type", "text/plain");
    return res.status(404).send(`Invalid group type: "${type}".`);
  }

  try {
    const requestedType = type as GroupType | undefined;
    const groupInfo = await getGroupInfo(shortname, requestedType);
    res.set("Cache-Control", `max-age=${seconds("24h")}`);
    res.json(groupInfo);
  } catch (error) {
    const { statusCode = 500, message } = error;
    res.set("Content-Type", "text/plain");
    res.status(statusCode).send(message);
  }
}

async function getGroupInfo(
  shortname: GroupMeta["name"],
  requestedType?: GroupType,
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
  id: GroupMeta["id"] | null,
  shortname: GroupMeta["name"],
  type: GroupType,
) {
  const url = new URL("https://api.w3.org/");
  if (id) {
    url.pathname = `/groups/${id}`;
  } else {
    url.pathname = `/groups/${type}/${shortname}`;
  }

  interface APIResponse {
    id: number;
    name: string;
    _links: Record<
      "homepage" | "pp-status" | "active-charter",
      { href: string }
    >;
  }
  try {
    const res = await fetch(url.href);
    if (!res.ok) {
      throw new HTTPError(res.status, res.statusText);
    }
    var json = (await res.json()) as APIResponse;
  } catch (error) {
    throw new HTTPError(
      error.statusCode || 500,
      error.message
    );
  }

  const { name, _links: links } = json;
  if (!id) {
    id = json.id;
  }

  const patentPolicy = links["active-charter"]?.href
    ? await getPatentPolicy(links["active-charter"].href)
    : undefined;

  return {
    shortname,
    type,
    id,
    name,
    URI: links.homepage?.href,
    patentURI: links["pp-status"]?.href,
    patentPolicy,
    wgURI: `https://www.w3.org/groups/${type}/${shortname}`,
  };
}

async function getPatentPolicy(
  activeCharterApiUrl: string,
): Promise<Required<Group["patentPolicy"]>> {
  const url = new URL(activeCharterApiUrl);

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

function getGroupMeta(shortname: string, requestedType?: GroupType) {
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
      if (requestedType && shortname) {
        return { type: requestedType, id: null };
      }
      const msg = `No group with shortname: "${shortname}"${
        requestedType ? ` and type: "${requestedType}"` : ""
      }.`;
      throw new HTTPError(404, msg);
    }
    default: {
      const msg = `Multiple groups with shortname: "${shortname}".`;
      const suggestions = data.map(g => `"${g.type}/${shortname}"`).join(", ");
      const hint = `Please use either: ${suggestions}.`;
      throw new HTTPError(409, `${msg}\n${hint}`);
    }
  }
}
