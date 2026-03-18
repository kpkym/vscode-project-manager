import * as vscode from 'vscode';
import { Group, Project } from './types';

export class GroupItem extends vscode.TreeItem {
  readonly contextValue = 'group'; // MUST match viewItem == group in package.json

  constructor(public readonly group: Group, expanded: boolean = true) {
    super(group.name, expanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
    this.tooltip = group.name;
    this.iconPath = new vscode.ThemeIcon('folder');
  }
}

export class ProjectItem extends vscode.TreeItem {
  readonly contextValue = 'project'; // MUST match viewItem == project in package.json

  constructor(
    public readonly project: Project,
    public readonly groupName: string
  ) {
    super(project.name, vscode.TreeItemCollapsibleState.None);
    this.tooltip = project.path;
    this.description = project.path;
    this.iconPath = new vscode.ThemeIcon('repo');
    // Left-click triggers openProject command
    this.command = {
      command: 'projectManager.openProjectInCurrentWindow',
      title: 'Open Project',
      arguments: [this],
    };
  }
}

export type TreeNode = GroupItem | ProjectItem;
