import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { GroupItem, ProjectItem, TreeNode } from './treeItems';

export class ProjectTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> =
    this._onDidChangeTreeData.event;

  private treeView: vscode.TreeView<TreeNode> | undefined;
  private cachedGroups: GroupItem[] = [];
  private filterText = '';

  constructor(private readonly configManager: ConfigManager) {}

  setTreeView(treeView: vscode.TreeView<TreeNode>): void {
    this.treeView = treeView;
  }

  setFilter(text: string): void {
    this.filterText = text.toLowerCase();
    this.refresh();
  }

  clearFilter(): void {
    this.filterText = '';
    this.refresh();
  }

  async expandAll(): Promise<void> {
    for (const group of this.cachedGroups) {
      try {
        await this.treeView?.reveal(group, { expand: true });
      } catch {
        // ignore if reveal fails
      }
    }
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getParent(element: TreeNode): vscode.ProviderResult<TreeNode> {
    if (element instanceof ProjectItem) {
      return this.cachedGroups.find(g => g.group.name === element.groupName);
    }
    return undefined;
  }

  getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
    if (!element) {
      const defaultExpanded = this.configManager.getConfig().defaultExpanded ?? true;
      const groups = this.filterText
        ? this.configManager.getGroups().filter(g =>
            g.projects.some(p => p.name.toLowerCase().includes(this.filterText))
          )
        : this.configManager.getGroups();
      this.cachedGroups = groups.map(g => new GroupItem(g, defaultExpanded || !!this.filterText));
      return this.cachedGroups;
    }

    if (element instanceof GroupItem) {
      const projects = this.filterText
        ? element.group.projects.filter(p => p.name.toLowerCase().includes(this.filterText))
        : element.group.projects;
      return projects.map(p => new ProjectItem(p, element.group.name));
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
