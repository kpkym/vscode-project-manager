import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { Config, Cache, Group, Project } from './types';

function getConfigPath(): string {
  const configured = vscode.workspace.getConfiguration('projectManager').get<string>('configFile');
  return configured || path.join(os.homedir(), '.config', 'vscode-project-manager', 'settings.json');
}

function getCachePath(): string {
  return path.join(os.homedir(), '.cache', 'vscode-project-manager', 'projects.json');
}

export class ConfigManager {
  private config: Config = {};
  private cache: Cache = { groups: [] };

  getConfigPath(): string {
    return getConfigPath();
  }

  getCachePath(): string {
    return getCachePath();
  }

  async load(): Promise<void> {
    // Load config
    try {
      const raw = await fs.readFile(getConfigPath(), 'utf-8');
      this.config = JSON.parse(raw) as Config;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
        await this.saveConfig();
      } else {
        throw err;
      }
    }

    // Load cache
    try {
      const raw = await fs.readFile(getCachePath(), 'utf-8');
      this.cache = JSON.parse(raw) as Cache;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(path.dirname(getCachePath()), { recursive: true });
        await this.saveCache();
      } else {
        throw err;
      }
    }
  }

  async saveConfig(): Promise<void> {
    await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
    await fs.writeFile(getConfigPath(), JSON.stringify(this.config, null, 2), 'utf-8');
  }

  async saveCache(): Promise<void> {
    await fs.mkdir(path.dirname(getCachePath()), { recursive: true });
    await fs.writeFile(getCachePath(), JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  getConfig(): Config {
    return this.config;
  }

  getGroups(): Group[] {
    return this.cache.groups;
  }

  // ── Scan operations ────────────────────────────────────────────────────

  async importScannedProjects(grouped: Map<string, Project[]>): Promise<number> {
    let added = 0;
    for (const [groupName, projects] of grouped) {
      let group = this.cache.groups.find(g => g.name === groupName);
      if (!group) {
        group = { name: groupName, projects: [] };
        this.cache.groups.push(group);
      }
      for (const project of projects) {
        if (!group.projects.some(p => p.path === project.path)) {
          group.projects.push(project);
          added++;
        }
      }
    }
    if (added > 0) {
      await this.saveCache();
    }
    return added;
  }

  async removeStaleProjects(): Promise<number> {
    let removed = 0;
    for (const group of this.cache.groups) {
      const before = group.projects.length;
      group.projects = group.projects.filter(p => {
        try {
          require('fs').accessSync(p.path);
          return true;
        } catch {
          return false;
        }
      });
      removed += before - group.projects.length;
    }
    // Remove empty groups
    this.cache.groups = this.cache.groups.filter(g => g.projects.length > 0);
    if (removed > 0) {
      await this.saveCache();
    }
    return removed;
  }
}
