import { Request, Response } from "express";
import { seconds } from "../../utils/misc.js";
import { BROWSERS, DEFAULT_BROWSERS } from "./lib/constants.js";
import { Data, getData } from "./lib/index.js";

type Params = { feature: string };
type Query = { browsers?: string | string[] };
type IRequest = Request<Params, any, any, Query>;

export default async function route(req: IRequest, res: Response) {
  const { feature } = req.params;
  const browsers = normalizeBrowsers(req.query.browsers);


  try {
    const data = await getData(feature);
    const result = [];
    for (const browser of browsers) {
      result.push({ browser, ...getBrowserData(data?.all[browser]) });
    }
    res.json({ result });
  } catch (error) {
    const errorCode = error.message === "INTERNAL_ERROR" ? 500 : 404;
    res.status(errorCode);
    res.setHeader("Content-Type", "text/plain");
    res.send(error.message);
  }
}

function normalizeBrowsers(browsers?: string | string[]) {
  if (!browsers) {
    return DEFAULT_BROWSERS;
  }
  if (typeof browsers === "string") {
    browsers = [browsers];
  }
  const validBrowsers = browsers.filter(browser => BROWSERS.has(browser));
  return validBrowsers.length ? validBrowsers : DEFAULT_BROWSERS;
}

function getBrowserData(data?: Data["all"][string]) {
  if (!data || !data.length) {
    return { caniuse: "u" };
  }
  // [version, suportKey[]][]
  // find the first change in compatibility
  let [lastVersion, currentSupportKeys] = data[0];
  // We know the last good support version (which can be even unsupported)
  // currentSupportKey "y"
  const [key] = currentSupportKeys;
  for (const [version, supportKeys] of data) {
    if (key !== supportKeys[0]) {
      return { caniuse: key, version: lastVersion };
    }
    lastVersion = version;
  }
  return { caniuse: "u" };
}
