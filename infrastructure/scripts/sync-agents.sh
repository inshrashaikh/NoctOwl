#!/bin/bash
# Sync OpenCode customizations to Antigravity paths
set -e

echo "=== Syncing OpenCode → Antigravity ==="

# Skills (already symlinked in M14, verify)
mkdir -p .agents/skills
for skill in .opencode/skills/*/; do
  name=$(basename "$skill")
  if [ ! -d ".agents/skills/$name" ]; then
    cp -r "$skill" ".agents/skills/$name"
    echo "Copied skill: $name"
  fi
done

# Agents (simplified versions, manual review recommended)
echo "Note: Agent files in .agents/agents/ require manual simplification."
echo "OpenCode agent frontmatter differs from Antigravity format."

# MCP config
if [ -f ".opencode/mcp.json" ]; then
  cp ".opencode/mcp.json" ".agents/mcp_config.json"
  echo "Synced MCP config"
fi

echo "=== Sync complete. Review .agents/ for Antigravity compatibility. ==="
