import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ConfigManager } from './configManager';
import { ProjectTreeProvider } from './projectTreeProvider';
import { ProjectItem } from './treeItems';

export async function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager();
  await configManager.load();

  const provider = new ProjectTreeProvider(configManager);
  const treeView = vscode.window.createTreeView('projectManagerView', { treeDataProvider: provider });
  provider.setTreeView(treeView);
  context.subscriptions.push(treeView);

  // Helper: register command and track disposable
  const reg = (cmd: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

  // ── Project commands ────────────────────────────────────────────────────

  reg('projectManager.openProject', async (item: ProjectItem) => {
    const uri = vscode.Uri.file(item.project.path);
    await vscode.commands.executeCommand('vscode.openFolder', uri, true);
  });

  reg('projectManager.openProjectInCurrentWindow', async (item: ProjectItem) => {
    const uri = vscode.Uri.file(item.project.path);
    await vscode.commands.executeCommand('vscode.openFolder', uri, false);
  });

  reg('projectManager.revealInFinder', async (item: ProjectItem) => {
    await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(item.project.path));
  });

  // ── Expand / Collapse all ──────────────────────────────────────────────

  let expanded = false;
  const updateExpandedContext = () =>
    vscode.commands.executeCommand('setContext', 'projectManager.expanded', expanded);
  updateExpandedContext();

  reg('projectManager.expandAll', async () => {
    await provider.expandAll();
    expanded = true;
    updateExpandedContext();
  });

  reg('projectManager.collapseAll', async () => {
    await vscode.commands.executeCommand('workbench.actions.treeView.projectManagerView.collapseAll');
    expanded = false;
    updateExpandedContext();
  });

  // ── Utility commands ────────────────────────────────────────────────────

  reg('projectManager.editConfig', async () => {
    const uri = vscode.Uri.file(configManager.getConfigPath());
    await vscode.window.showTextDocument(uri);
  });

  reg('projectManager.refresh', async () => {
    await configManager.load();
    await configManager.removeStaleProjects();
    await vscode.commands.executeCommand('projectManager.scanProjects');
    provider.refresh();
  });

  // ── Init config ────────────────────────────────────────────────────────

  reg('projectManager.initConfig', async () => {
    const configPath = configManager.getConfigPath();
    let exists = false;
    try {
      await fs.access(configPath);
      exists = true;
    } catch {
      // File doesn't exist
    }

    if (exists) {
      const confirm = await vscode.window.showWarningMessage(
        'Config file already exists. Overwrite it?',
        { modal: true },
        'Overwrite'
      );
      if (confirm !== 'Overwrite') return;
    }

    const defaultConfig = {
      scanDirs: [],
      scanMarker: '.gitignore',
      scanMaxDepth: 5,
    };

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    await configManager.load();
    provider.refresh();

    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
  });

  // ── Scan commands ──────────────────────────────────────────────────────

  reg('projectManager.scanProjects', async () => {
    const config = configManager.getConfig();
    const scanDirs = config.scanDirs ?? [];
    const scanMarker = config.scanMarker ?? '';
    const scanMaxDepth = config.scanMaxDepth ?? 3;

    if (scanDirs.length === 0) {
      await vscode.window.showErrorMessage(
        'scanDirs is not configured. Add scan directories to the config file.'
      );
      return;
    }
    if (!scanMarker) {
      await vscode.window.showErrorMessage(
        'scanMarker is not configured. Set the marker filename in the config file.'
      );
      return;
    }

    const grouped = new Map<string, { name: string; path: string }[]>();

    async function walk(scanRootName: string, dir: string, depth: number, topLevelDir: string | null): Promise<void> {
      if (depth > scanMaxDepth) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      // Check for marker file in this directory
      if (depth >= 1) {
        const markerPath = path.join(dir, scanMarker);
        try {
          await fs.access(markerPath);
          const groupName = depth === 1 ? scanRootName : (topLevelDir ?? scanRootName);
          const projects = grouped.get(groupName) ?? [];
          projects.push({ name: path.basename(dir), path: dir });
          grouped.set(groupName, projects);
          return;
        } catch {
          // Marker not found, continue
        }
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const childPath = path.join(dir, entry.name);
        const nextTopLevel = depth === 0 ? entry.name : topLevelDir;
        await walk(scanRootName, childPath, depth + 1, nextTopLevel);
      }
    }

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Scanning for projects...' },
      async () => {
        for (const scanDir of scanDirs) {
          const resolvedDir = scanDir.startsWith('~')
            ? path.join(os.homedir(), scanDir.slice(1))
            : scanDir;
          try {
            await fs.access(resolvedDir);
            await walk(path.basename(resolvedDir), resolvedDir, 0, null);
          } catch {
            // Skip dirs that don't exist
          }
        }
      }
    );

    if (grouped.size === 0) {
      await vscode.window.showInformationMessage('No projects found matching the configured marker.');
      return;
    }

    const added = await configManager.importScannedProjects(grouped);
    provider.refresh();

    if (added === 0) {
      await vscode.window.showInformationMessage('All discovered projects already exist in the config.');
    } else {
      await vscode.window.showInformationMessage(`Imported ${added} project(s) from scan.`);
    }
  });

  // ── FileSystemWatcher: auto-refresh when config edited externally ─────

  const watcher = vscode.workspace.createFileSystemWatcher(
    configManager.getConfigPath()
  );
  watcher.onDidChange(async () => {
    await configManager.load();
    provider.refresh();
  });
  context.subscriptions.push(watcher);
}

export function deactivate() {}
