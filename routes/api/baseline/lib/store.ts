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
  try {
    const u = new URL(url);
    u.hash = "";
    if (!u.pathname.endsWith("/") && !u.pathname.includes(".")) {
      u.pathname += "/";
    }
    return u.href;
  } catch {
    return url;
  }
}

export class BaselineStore {
  version = -1;
  data: WebFeaturesData | null = null;
  byFeature: Map<string, FeatureData> = new Map();
  bySpecUrl: Map<string, string[]> = new Map();

  constructor() {
    this.fill();
  }

  /** Fill the store with its contents from the filesystem. */
  fill() {
    const DATA_DIR = env("DATA_DIR");
    const dataFile = path.resolve(DATA_DIR, "baseline/baseline.json");

    if (!existsSync(dataFile)) {
      console.warn("baseline: data file not found, store is empty.");
      this.data = null;
      this.byFeature = new Map();
      this.bySpecUrl = new Map();
      this.version = Date.now();
      return;
    }

    const text = readFileSync(dataFile, "utf8");
    const data: WebFeaturesData = JSON.parse(text);
    this.data = data;

    this.byFeature = new Map();
    this.bySpecUrl = new Map();

    for (const [id, feature] of Object.entries(data.features)) {
      if (feature.kind !== "feature") continue;

      this.byFeature.set(id, feature);

      if (feature.spec) {
        for (const specUrl of feature.spec) {
          const normalized = normalizeUrl(specUrl);
          const existing = this.bySpecUrl.get(normalized) || [];
          existing.push(id);
          this.bySpecUrl.set(normalized, existing);
        }
      }
    }

    this.version = Date.now();
  }
}
