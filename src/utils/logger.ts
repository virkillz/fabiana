import fs from 'fs/promises';

export class Logger {
  private logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
  }

  static create(): Logger {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return new Logger(`.fabiana/data/logs/${month}.log`);
  }

  private timestamp(): string {
    return new Date().toISOString();
  }

  async log(message: string): Promise<void> {
    const line = `[${this.timestamp()}] INFO  ${message}\n`;
    await fs.appendFile(this.logPath, line, 'utf-8').catch(() => {});
  }

  async error(message: string, err?: Error): Promise<void> {
    const detail = err ? `: ${err.message}` : '';
    const line = `[${this.timestamp()}] ERROR ${message}${detail}\n`;
    await fs.appendFile(this.logPath, line, 'utf-8').catch(() => {});
  }

  async sessionStart(mode: string): Promise<void> {
    const line = `\n[${this.timestamp()}] ===== SESSION START (${mode}) =====\n`;
    await fs.appendFile(this.logPath, line, 'utf-8').catch(() => {});
  }

  async sessionEnd(success: boolean): Promise<void> {
    const status = success ? 'OK' : 'FAILED';
    const line = `[${this.timestamp()}] ===== SESSION END (${status}) =====\n`;
    await fs.appendFile(this.logPath, line, 'utf-8').catch(() => {});
  }
}
