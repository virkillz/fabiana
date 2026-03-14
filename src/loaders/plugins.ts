import fs from 'fs/promises';
import path from 'path';
import type { ToolDefinition } from '@mariozechner/pi-coding-agent';
import { PLUGINS_DIR, paths } from '../paths.js';

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
}

export interface Plugin {
  tool: ToolDefinition;
  metadata?: PluginMetadata;
}

export type PluginsConfig = Record<string, Record<string, unknown>>;

export class PluginLoader {
  private pluginsDir: string;
  private enabledPlugins: Set<string> | null = null;

  constructor(pluginsDir: string = PLUGINS_DIR) {
    this.pluginsDir = path.resolve(pluginsDir);
  }

  async loadAll(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    try {
      await fs.access(this.pluginsDir);
    } catch {
      console.log(`[PLUGINS] No plugins directory found at ${this.pluginsDir}`);
      return tools;
    }

    const entries = await fs.readdir(this.pluginsDir, { withFileTypes: true });
    const pluginDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (pluginDirs.length === 0) {
      console.log('[PLUGINS] No plugins found');
      return tools;
    }

    console.log(`[PLUGINS] Scanning ${pluginDirs.length} plugin(s)...`);

    for (const dir of pluginDirs) {
      if (this.enabledPlugins && !this.enabledPlugins.has(dir)) {
        console.log(`[PLUGINS] ⊘ ${dir} (disabled)`);
        continue;
      }

      try {
        const tsPath = path.join(this.pluginsDir, dir, 'index.ts');
        const jsPath = path.join(this.pluginsDir, dir, 'index.js');

        let pluginPath: string;
        try {
          await fs.access(tsPath);
          pluginPath = tsPath;
        } catch {
          try {
            await fs.access(jsPath);
            pluginPath = jsPath;
          } catch {
            console.log(`[PLUGINS] ⚠️  ${dir} (no index.ts or index.js found)`);
            continue;
          }
        }

        const module = await import(pluginPath);

        if (!module.tool) {
          console.log(`[PLUGINS] ⚠️  ${dir} (no tool export found)`);
          continue;
        }

        const tool = module.tool as ToolDefinition;
        const metadata = module.metadata as PluginMetadata | undefined;

        if (!tool.name || !tool.description || !tool.execute) {
          console.log(`[PLUGINS] ⚠️  ${dir} (invalid tool definition)`);
          continue;
        }

        tools.push(tool);
        const version = metadata?.version ? `v${metadata.version}` : '';
        console.log(`[PLUGINS] ✓ ${tool.name} ${version}`.trim());

      } catch (err: any) {
        console.log(`[PLUGINS] ✗ ${dir} (${err.message})`);
      }
    }

    return tools;
  }

  async loadPluginConfig(configPath: string = paths.pluginsJson): Promise<void> {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const config: PluginsConfig = JSON.parse(content);

      const enabled = Object.entries(config)
        .filter(([, pluginCfg]) => pluginCfg.enabled !== false)
        .map(([name]) => name);

      this.enabledPlugins = new Set(enabled);
      console.log(`[PLUGINS] Loaded config: ${enabled.length} enabled`);
    } catch {
      // No config file or invalid — load all plugins
    }
  }
}

export async function loadPlugins(pluginsDir?: string): Promise<ToolDefinition[]> {
  const loader = new PluginLoader(pluginsDir);
  await loader.loadPluginConfig();
  return loader.loadAll();
}

export async function loadPluginsConfig(configPath: string = paths.pluginsJson): Promise<PluginsConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export async function savePluginsConfig(config: PluginsConfig, configPath: string = paths.pluginsJson): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
}
