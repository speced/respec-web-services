// @ts-check
const { join } = require("path");
const { writeFile, readFile, readdir } = require("fs").promises;

/** @param {string} file */
async function readJSON(file) {
  try {
    const text = await readFile(file, "utf8");
    return JSON.parse(text);
  } catch (error) {
    console.error(error);
    return error.message;
  }
}

/**
 * @param {string} file
 * @param {object} json
 */
async function writeJSON(file, json) {
  await writeFile(file, JSON.stringify(json), "utf8");
}

/**
 * Get full file paths of files in a directory.
 * @param {string} dir
 */
async function readDir(dir, { depth = 1 } = {}) {
  /** @type {string[]} */
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isFile()) {
      files.push(file);
    } else if (entry.isDirectory() && depth > 1) {
      const filesInSubDir = await readDir(file, { depth: depth - 1 });
      files.push(...filesInSubDir);
    }
  }
  return files;
}

module.exports = {
  readJSON,
  writeJSON,
  readDir,
};
