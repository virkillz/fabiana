import fs from 'fs/promises';
import path from 'path';
import { minimatch } from 'minimatch';

export interface PermissionManifest {
  version: string;
  permissions: {
    readonly: string[];
    writable: string[];
    appendonly: string[];
  };
}

export class PermissionValidator {
  private manifest: PermissionManifest;
  private baseDir: string;

  constructor(manifest: PermissionManifest, baseDir: string) {
    this.manifest = manifest;
    this.baseDir = baseDir;
  }

  static async load(manifestPath: string): Promise<PermissionValidator> {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as PermissionManifest;
    return new PermissionValidator(manifest, process.cwd());
  }

  private normalizePath(filePath: string): string {
    const absolute = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.baseDir, filePath);
    const relative = path.relative(this.baseDir, absolute);
    if (relative.startsWith('..')) throw new Error(`Path outside project: ${filePath}`);
    return relative;
  }

  private matchesPattern(filePath: string, patterns: string[]): boolean {
    const normalized = this.normalizePath(filePath);
    return patterns.some(pattern => {
      if (pattern === normalized) return true;
      if (pattern.includes('*')) return minimatch(normalized, pattern, { dot: true });
      if (pattern.endsWith('/**')) {
        const dir = pattern.slice(0, -3);
        return normalized === dir || normalized.startsWith(dir + '/');
      }
      return false;
    });
  }

  canRead(_filePath: string): boolean { return true; }

  canWrite(filePath: string): boolean {
    try {
      if (this.matchesPattern(filePath, this.manifest.permissions.readonly)) return false;
      if (this.matchesPattern(filePath, this.manifest.permissions.writable)) return true;
      return false;
    } catch { return false; }
  }

  canEdit(filePath: string): boolean { return this.canWrite(filePath); }

  canAppend(filePath: string): boolean {
    try {
      if (this.matchesPattern(filePath, this.manifest.permissions.readonly)) return false;
      if (this.matchesPattern(filePath, this.manifest.permissions.appendonly)) return true;
      if (this.matchesPattern(filePath, this.manifest.permissions.writable)) return true;
      return false;
    } catch { return false; }
  }
}
