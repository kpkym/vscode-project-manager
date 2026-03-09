import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { GroupItem, ProjectItem, TreeNode } from './treeItems';

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private readonly configManager: ConfigManager) {}

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
    if (!element) {
      return this.configManager.getGroups().map(g => new GroupItem(g));
    }

    if (element instanceof GroupItem) {
      return element.group.projects.map(p => new ProjectItem(p, element.group.name));
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
