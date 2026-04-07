import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { inspect } from 'node:util';

export type LogLevel = 'info' | 'warn' | 'error';

export class AppLogger {
  private readonly logFile: string;

  constructor() {
    const logDir = join(app.getPath('userData'), 'logs');
    mkdirSync(logDir, { recursive: true });
    this.logFile = join(logDir, 'app.log');
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
    const suffix = meta === undefined ? '' : ` ${inspect(meta, { depth: 6, breakLength: 120 })}`;
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${suffix}\n`;
    appendFileSync(this.logFile, line, 'utf8');
  }
}
