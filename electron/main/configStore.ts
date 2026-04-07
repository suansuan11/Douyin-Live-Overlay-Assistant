import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { migrateConfig, type AppConfig } from '../../src/shared/config';

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

  getPath(): string {
    return this.filePath;
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.config = migrateConfig(mergeDeep(this.config as unknown as JsonObject, patch));
    this.save();
    return this.get();
  }

  replace(next: unknown): AppConfig {
    this.config = migrateConfig(next);
    this.save();
    return this.get();
  }

  private load(): AppConfig {
    if (!existsSync(this.filePath)) {
      const config = migrateConfig(undefined);
      this.config = config;
      this.save();
      return config;
    }

    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown;
      const config = migrateConfig(raw);
      this.config = config;
      this.save();
      return config;
    } catch {
      const config = migrateConfig(undefined);
      this.config = config;
      this.save();
      return config;
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.config, null, 2)}\n`, 'utf8');
  }
}
