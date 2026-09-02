import { readFileSync, statSync } from "node:fs";

import { DATA_FILE } from "./paths.js";
import { isUnsafeKey, Reference, References, validate } from "./validate.js";

export class Store {
  /** Set until `fill` accepts a data file. The route answers 503 while it is. */
  degraded = true;
  dataWrittenAt: Date | null = null;
  references: References = {};
  /** Do not make this a getter: /monitor/usage reads it on every request. */
  entries = 0;

  constructor() {
    this.fill();
  }

  fill() {
    let incoming: unknown;
    try {
      incoming = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    } catch (error) {
      console.warn(
        `bibrefs: cannot read ${DATA_FILE}, keeping existing data.`,
        error,
      );
      return;
    }

    const problem = validate(incoming);
    if (problem) {
      console.warn(
        `bibrefs: rejected new data (${problem}), keeping existing data.`,
      );
      return;
    }

    this.references = incoming as References;
    this.entries = Object.keys(this.references).length;
    this.dataWrittenAt = statSync(DATA_FILE).mtime;
    this.degraded = false;
  }

  getRefs(keys: string[]) {
    return getRefs(this.references, keys);
  }
}

/**
 * Look up each key and return everything needed to render it: the entries along
 * its chain of aliases, and the parent it is a version of. A key that is absent
 * but whose upper-case form exists gets an alias record made for it, so
 * `[[webidl]]` finds the entry stored under `WEBIDL`. Unknown keys are left out.
 */
export function getRefs(references: References, keys: string[]): References {
  // No prototype while filling, so assigning a key cannot re-point one. Safe
  // only because collect refuses the keys that would become real properties.
  const output: References = Object.create(null);
  for (const key of keys) collect(references, key, output);
  // Copy before returning. An object built by assigning keys one at a time ends
  // up in V8's dictionary mode; the copy hands back one with fast properties,
  // which JSON.stringify serializes faster.
  return { ...output };
}

function collect(references: References, key: string, output: References) {
  if (isUnsafeKey(key)) return;
  let reference = key;
  let entry: Reference | undefined;
  const seen = new Set<string>();

  while (!seen.has(reference)) {
    seen.add(reference);
    // Object.hasOwn, not a truthiness test: a caller may ask for a reference
    // named `constructor` or `toString`, which every plain object inherits.
    entry = Object.hasOwn(references, reference)
      ? references[reference]
      : undefined;
    const upper = reference.toUpperCase();
    if (
      !entry &&
      !Object.hasOwn(output, reference) &&
      Object.hasOwn(references, upper)
    ) {
      output[reference] = { aliasOf: upper, id: reference };
      reference = upper;
      entry = references[reference];
    }
    if (entry && !Object.hasOwn(output, reference)) output[reference] = entry;
    if (!entry?.aliasOf || isUnsafeKey(entry.aliasOf)) break;
    reference = entry.aliasOf;
  }

  const parent = entry?.versionOf;
  if (parent && !isUnsafeKey(parent) && Object.hasOwn(references, parent)) {
    output[parent] = references[parent];
  }
}
