import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';

export type LogLevel = 'info' | 'warn' | 'error';

export class AppLogger {
  private readonly logDir: string;
  private readonly logFile: string;
  private readonly maxBytes = 2 * 1024 * 1024;

  constructor() {
    this.logDir = join(app.getPath('userData'), 'logs');
    mkdirSync(this.logDir, { recursive: true });
    this.logFile = join(this.logDir, 'app.log');
  }

  getLogDir(): string {
    return this.logDir;
  }

  info(message: string, meta?: unknown): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write('error', message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    this.rotateIfNeeded();
    const suffix = meta === undefined ? '' : ` ${inspect(meta, { depth: 6, breakLength: 120 })}`;
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${suffix}\n`;
    appendFileSync(this.logFile, line, 'utf8');
  }

  private rotateIfNeeded(): void {
    if (!existsSync(this.logFile)) {
      return;
    }
    const size = statSync(this.logFile).size;
    if (size < this.maxBytes) {
      return;
    }
    renameSync(this.logFile, join(this.logDir, `app-${Date.now()}.log`));
  }
}
