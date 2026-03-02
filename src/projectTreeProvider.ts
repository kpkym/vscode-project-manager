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
    const config = this.configManager.getConfig();

    if (!element) {
      // Root level: return all GroupItems
      return config.groups.map(g => new GroupItem(g));
    }

    if (element instanceof GroupItem) {
      // Second level: return ProjectItems for this group
      return element.group.projects.map(p => new ProjectItem(p, element.group.name));
    }

    // ProjectItems are leaf nodes
    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
