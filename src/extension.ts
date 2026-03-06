import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { ConfigManager } from './configManager';
import { ProjectTreeProvider } from './projectTreeProvider';
import { GroupItem, ProjectItem } from './treeItems';

export async function activate(context: vscode.ExtensionContext) {
  const configManager = new ConfigManager();
  await configManager.load();

  const provider = new ProjectTreeProvider(configManager);
  vscode.window.registerTreeDataProvider('projectManagerView', provider);

  // Helper: register command and track disposable
  const reg = (cmd: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(cmd, fn));

  // ── Project commands ────────────────────────────────────────────────────

  reg('projectManager.openProject', async (item: ProjectItem) => {
    const uri = vscode.Uri.file(item.project.path);
    await vscode.commands.executeCommand('vscode.openFolder', uri, true);
  });

  reg('projectManager.renameProject', async (item: ProjectItem) => {
    const newName = await vscode.window.showInputBox({
      prompt: 'New project name',
      value: item.project.name,
    });
    if (!newName || newName === item.project.name) return;
    await configManager.renameProject(item.groupName, item.project.name, newName);
    provider.refresh();
  });

  reg('projectManager.removeProject', async (item: ProjectItem) => {
    const confirm = await vscode.window.showWarningMessage(
      `Remove "${item.project.name}" from group "${item.groupName}"?`,
      { modal: true },
      'Remove'
    );
    if (confirm !== 'Remove') return;
    await configManager.removeProject(item.groupName, item.project.name);
    provider.refresh();
  });

  // ── Group commands ──────────────────────────────────────────────────────

  reg('projectManager.addGroup', async () => {
    const name = await vscode.window.showInputBox({ prompt: 'Group name' });
    if (!name) return;
    await configManager.addGroup(name);
    provider.refresh();
  });

  reg('projectManager.renameGroup', async (item: GroupItem) => {
    const newName = await vscode.window.showInputBox({
      prompt: 'New group name',
      value: item.group.name,
    });
    if (!newName || newName === item.group.name) return;
    await configManager.renameGroup(item.group.name, newName);
    provider.refresh();
  });

  reg('projectManager.deleteGroup', async (item: GroupItem) => {
    const confirm = await vscode.window.showWarningMessage(
      `Delete group "${item.group.name}" and all its projects?`,
      { modal: true },
      'Delete'
    );
    if (confirm !== 'Delete') return;
    await configManager.deleteGroup(item.group.name);
    provider.refresh();
  });

  reg('projectManager.addProject', async (item: GroupItem) => {
    // Native folder picker — no manual path typing
    const uris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select Project Folder',
    });
    if (!uris || uris.length === 0) return;

    const folderPath = uris[0].fsPath;
    const defaultName = path.basename(folderPath);

    const name = await vscode.window.showInputBox({
      prompt: 'Project display name',
      value: defaultName,
    });
    if (!name) return;

    await configManager.addProject(item.group.name, { name, path: folderPath });
    provider.refresh();
  });

  reg('projectManager.addCurrentToGroup', async () => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      await vscode.window.showErrorMessage('No folder is open in the current workspace.');
      return;
    }
    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const activeFolder = activeUri
      ? vscode.workspace.getWorkspaceFolder(activeUri)
      : undefined;
    const folder = activeFolder ?? folders[0];
    const folderPath = folder.uri.fsPath;

    const groups = configManager.getConfig().groups;
    const NEW_GROUP = '$(add) New group...';

    const picked = await vscode.window.showQuickPick(
      [NEW_GROUP, ...groups.map(g => g.name)],
      { placeHolder: 'Select a group to add this project to' }
    );
    if (!picked) return;

    let groupName: string;
    if (picked === NEW_GROUP) {
      const newName = await vscode.window.showInputBox({ prompt: 'Group name' });
      if (!newName) return;
      if (configManager.getConfig().groups.some(g => g.name === newName)) {
        await vscode.window.showErrorMessage(`Group "${newName}" already exists.`);
        return;
      }
      await configManager.addGroup(newName);
      groupName = newName;
    } else {
      groupName = picked;
    }

    const defaultName = path.basename(folderPath);
    const name = await vscode.window.showInputBox({
      prompt: 'Project display name',
      value: defaultName,
    });
    if (!name) return;

    await configManager.addProject(groupName, { name, path: folderPath });
    provider.refresh();
  });

  // ── Utility commands ────────────────────────────────────────────────────

  reg('projectManager.editConfig', async () => {
    const uri = vscode.Uri.file(configManager.getConfigPath());
    await vscode.window.showTextDocument(uri);
  });

  reg('projectManager.refresh', async () => {
    await configManager.load();
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
      scanMarker: '',
      scanMaxDepth: 3,
      groups: [],
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

  // ── FileSystemWatcher: auto-refresh when JSON edited externally ─────────

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
