# Project Manager for VS Code

A lightweight VS Code extension for managing and quickly switching between projects from the sidebar, organized into groups.

## Features

- **Sidebar tree view** — Projects organized into collapsible groups, accessible from the activity bar
- **One-click project switching** — Click a project to open it in a new window
- **Group management** — Create, rename, and delete groups to organize your projects
- **Project management** — Add folders via picker, rename, or remove projects within groups
- **Add current folder** — Quickly add the currently open workspace to any group via the Command Palette
- **Project scanning** — Automatically discover projects in configured directories by looking for a marker file (e.g., `.gitignore`)
- **Config file init** — Bootstrap a config file with sensible defaults from the title bar
- **External edit support** — Config file changes made outside VS Code are picked up automatically
- **Configurable config path** — Override the default config location via the `projectManager.configDir` setting

## Getting Started

1. Install the extension
2. Click the **Project Manager** icon in the activity bar
3. Click the **Init Config** button (file-add icon) in the view title bar to create a config file, or start adding groups with the **+** button

## Commands

| Command | Description |
|---|---|
| Add Group | Create a new project group |
| Rename Group | Rename an existing group |
| Delete Group | Delete a group and all its projects |
| Add Project | Add a folder to a group via the folder picker |
| Open in New Window | Open a project in a new VS Code window |
| Rename Project | Change a project's display name |
| Remove Project | Remove a project from its group |
| Add Current Folder to Project Manager | Add the active workspace folder to a group |
| Scan Projects | Discover projects in configured scan directories |
| Init Config | Create or reset the config file with defaults |
| Edit Config File | Open the JSON config file in the editor |
| Refresh | Reload the config and refresh the tree view |

## Configuration

The config file lives at `~/.config/vscode/vscode-project-manager.json` by default. You can override the directory with the `projectManager.configDir` setting.

### Config file structure

```json
{
  "scanDirs": ["~/code", "~/work"],
  "scanMarker": ".gitignore",
  "scanMaxDepth": 5,
  "groups": [
    {
      "name": "Personal",
      "projects": [
        { "name": "my-app", "path": "/Users/me/code/my-app" }
      ]
    }
  ]
}
```

### Scan fields

| Field | Description | Default |
|---|---|---|
| `scanDirs` | Directories to scan for projects (supports `~`) | `[]` |
| `scanMarker` | Filename that identifies a project directory | `".gitignore"` |
| `scanMaxDepth` | Maximum directory depth to scan | `5` |

When scanning, projects are grouped by their top-level parent directory within each scan root.

## Installation

```bash
bash install.sh
```

This builds the extension, installs it into VS Code, and cleans up the `.vsix` artifact. Reload VS Code to activate.

## Development

```bash
bun install
bun run compile
# Press F5 in VS Code to launch the Extension Development Host
```
