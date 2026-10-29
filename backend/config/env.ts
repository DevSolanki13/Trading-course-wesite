import "server-only";
import { configuredValue } from "./environment";

export class MissingConfigurationError extends Error {
  constructor(key: string) {
    super(`Missing or placeholder environment variable: ${key}`);
    this.name = "MissingConfigurationError";
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!configuredValue(value)) throw new MissingConfigurationError(key);
  return value!;
}
