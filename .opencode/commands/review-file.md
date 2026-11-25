---
description: Review a specific file for issues
agent: reviewer
---

# Review: $1

## File Content
@$1

## Recent Changes to This File
!`git log --oneline -5 -- "$1" 2>/dev/null || echo "No git history"`

Review the file content above. Report:
1. **Correctness:** Any bugs, logic errors, edge cases missed?
2. **Security:** Any injection, auth bypass, data exposure?
3. **Consistency:** Does it follow AGENTS.md conventions?
4. **Tests:** What's missing test coverage?

Report findings in severity order. Do NOT modify the file.
