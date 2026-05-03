import path from "path";
import { existsSync, readFileSync } from "fs";

import { env } from "../../../../utils/misc.js";

interface SupportData {
  chrome?: string;
  chrome_android?: string;
  edge?: string;
  firefox?: string;
  firefox_android?: string;
  safari?: string;
  safari_ios?: string;
}

interface StatusData {
  baseline: "high" | "low" | false;
  baseline_low_date?: string;
  baseline_high_date?: string;
  support: SupportData;
}

export interface FeatureData {
  kind: "feature" | "moved" | "split";
  name?: string;
  description?: string;
  description_html?: string;
  spec?: string[];
  status?: StatusData;
  caniuse?: string[];
  compat_features?: string[];
  group?: string[];
  snapshot?: string[];
  redirect_target?: string;
  redirect_targets?: string[];
}

interface WebFeaturesData {
  browsers: Record<string, unknown>;
  features: Record<string, FeatureData>;
  groups: Record<string, unknown>;
  snapshots: Record<string, unknown>;
}

export function normalizeUrl(url: string): string {
  const parsed = URL.parse(url);
  if (!parsed) return url;
  parsed.hash = "";
  parsed.search = "";
  if (!parsed.pathname.endsWith("/") && !parsed.pathname.includes(".")) {
    parsed.pathname += "/";
  }
  return parsed.href;
}

export class BaselineStore {
  version = -1;
  data: WebFeaturesData | null = null;
  byFeature = new Map<string, FeatureData>();
  bySpecUrl = new Map<string, string[]>();

  constructor() {
    this.fill();
  }

  fill() {
    const dataFile = path.resolve(env("DATA_DIR"), "baseline/baseline.json");

    if (!existsSync(dataFile)) {
      console.warn("baseline: data file not found, store is empty.");
      this.data = null;
      this.byFeature = new Map();
      this.bySpecUrl = new Map();
      this.version = Date.now();
      return;
    }

    try {
      const data = JSON.parse(readFileSync(dataFile, "utf8")) as WebFeaturesData;

      const features = Object.entries(data.features).filter(
        ([, feature]) => feature.kind === "feature",
      );

      const byFeature = new Map(features);
      const bySpecUrl = new Map<string, string[]>();
      for (const [featureId, feature] of features) {
        for (const specUrl of feature.spec ?? []) {
          const normalized = normalizeUrl(specUrl);
          const ids = bySpecUrl.get(normalized) ?? [];
          ids.push(featureId);
          bySpecUrl.set(normalized, ids);
        }
      }

      this.data = data;
      this.byFeature = byFeature;
      this.bySpecUrl = bySpecUrl;
      this.version = Date.now();
    } catch (error) {
      console.warn(
        "baseline: failed to read or parse data file, keeping existing store data.",
        error,
      );
      return;
    }
  }
}
