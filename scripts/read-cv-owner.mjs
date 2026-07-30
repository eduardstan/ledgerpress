#!/usr/bin/env node

import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

export function readCvOwner(source, path = "content/cv.yaml") {
  let record;
  try {
    record = load(source);
  } catch (error) {
    throw new Error(`${path}: profile.name could not be determined: ${error.message}`);
  }
  const name = record?.profile?.name;
  const scalar = typeof name === "string" || typeof name === "number" || typeof name === "boolean" || name instanceof Date;
  const owner = name instanceof Date ? name.toISOString().slice(0, 10) : scalar ? String(name) : "";
  if (!owner.trim()) {
    throw new Error(`${path}: profile.name could not be determined: expected one non-empty scalar`);
  }
  return owner;
}

function main() {
  const path = process.argv[2] ?? "content/cv.yaml";
  try {
    process.stdout.write(readCvOwner(readFileSync(path, "utf8"), path));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) main();
