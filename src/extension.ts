import * as vscode from 'vscode';
import * as path from 'path';
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

  // ── Utility commands ────────────────────────────────────────────────────

  reg('projectManager.editConfig', async () => {
    const uri = vscode.Uri.file(configManager.getConfigPath());
    await vscode.window.showTextDocument(uri);
  });

  reg('projectManager.refresh', async () => {
    await configManager.load();
    provider.refresh();
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
