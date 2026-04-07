import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep<T extends JsonObject>(base: T, patch: unknown): T {
  if (!isObject(patch)) {
    return { ...base };
  }

  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    result[key] = isObject(current) && isObject(value) ? mergeDeep(current, value) : value;
  }

  return result as T;
}

export class ConfigStore {
  private readonly filePath: string;
  private config: AppConfig;

  constructor() {
    this.filePath = join(app.getPath('userData'), 'config.json');
    this.config = this.load();
  }

  get(): AppConfig {
    return structuredClone(this.config);
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.config = mergeDeep(this.config as unknown as JsonObject, patch) as unknown as AppConfig;
    this.save();
    return this.get();
  }

  private load(): AppConfig {
    if (!existsSync(this.filePath)) {
      return structuredClone(DEFAULT_CONFIG);
    }

    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      return mergeDeep(DEFAULT_CONFIG as unknown as JsonObject, raw) as unknown as AppConfig;
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');
  }
}
