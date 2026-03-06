#!/bin/bash
set -e

cd "$(dirname "$0")"
bun run package
code --install-extension vscode-project-manager-*.vsix
rm -f vscode-project-manager-*.vsix
echo "Installed successfully. Reload VS Code to activate."
