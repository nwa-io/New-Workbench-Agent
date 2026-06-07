import yaml from "js-yaml";
import type { NwaFile } from "./ctx";

export function dumpYaml(value: unknown): string {
  return yaml.dump(value, {
    noRefs: true,
    lineWidth: 120,
    skipInvalid: true,
    sortKeys: false,
  });
}

export function textFile(content: string): NwaFile {
  return { kind: "text", content };
}

export function binaryFile(base64: string): NwaFile {
  return { kind: "binary", base64 };
}

export function safe<T>(fn: () => T): T | undefined {
  try {
    const v = fn();
    if (typeof v === "symbol") return undefined;
    return v;
  } catch {
    return undefined;
  }
}

export function cleanFigmaValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "symbol") return "mixed";
  if (Array.isArray(value)) return value.map(cleanFigmaValue);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      try {
        out[k] = cleanFigmaValue((value as Record<string, unknown>)[k]);
      } catch {
        /* skip */
      }
    }
    return out;
  }
  return value;
}
