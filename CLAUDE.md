# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A VS Code extension that provides a sidebar tree view for managing and quickly opening saved projects, organized into groups. Configuration is stored as JSON at `~/.config/vscode/vscode-project-manager.json` (overridable via the `projectManager.configDir` setting).

## Build Commands

```bash
bun run compile        # Compile TypeScript to out/
bun run watch          # Compile in watch mode
bun run package        # Package as .vsix using vsce
```

No test framework is configured. To test, use VS Code's Extension Development Host (F5 in VS Code).

## Architecture

The extension follows a simple MVC-like pattern with 5 source files in `src/`:

- **types.ts** - Data model: `Config` contains `Group[]`, each `Group` contains `Project[]` (name + path). Config also has optional scan fields (`scanDirs`, `scanMarker`, `scanMaxDepth`).
- **configManager.ts** - Reads/writes the JSON config file, provides CRUD operations for groups and projects. All mutations call `save()` which writes back to disk. The config path is resolved via `getConfigPath()` which reads the `projectManager.configDir` VS Code setting.
- **treeItems.ts** - VS Code `TreeItem` subclasses: `GroupItem` (folders) and `ProjectItem` (leaves). The `contextValue` property (`'group'` / `'project'`) controls which context menu commands appear (must match `viewItem` conditions in `package.json`).
- **projectTreeProvider.ts** - `TreeDataProvider` that maps config data to the tree view. Two levels: groups at root, projects as children.
- **extension.ts** - Entry point. Wires up all command handlers, registers the tree provider, and sets up a `FileSystemWatcher` to auto-reload when the config file changes externally.

## Key Conventions

- All commands are prefixed with `projectManager.` and registered in both `package.json` (contributes.commands + menus) and `extension.ts`
- When adding a new command: add it to `package.json` contributes.commands, add menu entries if needed (with appropriate `when` clauses using `viewItem == group` or `viewItem == project`), and register the handler in `extension.ts`
- Context menu visibility is controlled by `contextValue` on tree items matching `viewItem` conditions in `package.json` menus — these must stay in sync
- Tree items use VS Code built-in `ThemeIcon`s (`folder`, `repo`, `refresh`, `gear`, `add`)
