import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { Config, Group, Project } from './types';

function getConfigPath(): string {
  const configured = vscode.workspace.getConfiguration('projectManager').get<string>('configDir');
  const dir = configured || path.join(os.homedir(), '.config', 'vscode');
  return path.join(dir, 'vscode-project-manager.json');
}

export class ConfigManager {
  private config: Config = { groups: [] };

  getConfigPath(): string {
    return getConfigPath();
  }

  async load(): Promise<Config> {
    try {
      const raw = await fs.readFile(getConfigPath(), 'utf-8');
      this.config = JSON.parse(raw) as Config;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
        await this.save();
      } else {
        throw err;
      }
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(getConfigPath()), { recursive: true });
    await fs.writeFile(getConfigPath(), JSON.stringify(this.config, null, 2), 'utf-8');
  }

  getConfig(): Config {
    return this.config;
  }

  // ── Group operations ────────────────────────────────────────────────────

  async addGroup(name: string): Promise<void> {
    this.config.groups.push({ name, projects: [] });
    await this.save();
  }

  async renameGroup(oldName: string, newName: string): Promise<void> {
    const group = this.requireGroup(oldName);
    group.name = newName;
    await this.save();
  }

  async deleteGroup(name: string): Promise<void> {
    this.config.groups = this.config.groups.filter(g => g.name !== name);
    await this.save();
  }

  // ── Project operations ──────────────────────────────────────────────────

  async addProject(groupName: string, project: Project): Promise<void> {
    const group = this.requireGroup(groupName);
    group.projects.push(project);
    await this.save();
  }

  async importScannedProjects(grouped: Map<string, Project[]>): Promise<number> {
    let added = 0;
    for (const [groupName, projects] of grouped) {
      let group = this.config.groups.find(g => g.name === groupName);
      if (!group) {
        group = { name: groupName, projects: [] };
        this.config.groups.push(group);
      }
      for (const project of projects) {
        if (!group.projects.some(p => p.path === project.path)) {
          group.projects.push(project);
          added++;
        }
      }
    }
    if (added > 0) {
      await this.save();
    }
    return added;
  }

  async renameProject(groupName: string, oldName: string, newName: string): Promise<void> {
    const group = this.requireGroup(groupName);
    const proj = group.projects.find(p => p.name === oldName);
    if (!proj) throw new Error(`Project "${oldName}" not found in group "${groupName}"`);
    proj.name = newName;
    await this.save();
  }

  async removeProject(groupName: string, projectName: string): Promise<void> {
    const group = this.requireGroup(groupName);
    group.projects = group.projects.filter(p => p.name !== projectName);
    await this.save();
  }

  async removeStaleProjects(): Promise<number> {
    let removed = 0;
    for (const group of this.config.groups) {
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
    this.config.groups = this.config.groups.filter(g => g.projects.length > 0);
    if (removed > 0) {
      await this.save();
    }
    return removed;
  }

  private requireGroup(name: string): Group {
    const group = this.config.groups.find(g => g.name === name);
    if (!group) throw new Error(`Group "${name}" not found`);
    return group;
  }
}
