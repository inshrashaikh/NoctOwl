---
description: Review current changes using reviewer and security-auditor agents
agent: build
---

# Code Review

1. Use the `reviewer` subagent to review uncommitted changes.
2. Use the `security-auditor` subagent to audit for OWASP issues.
3. Combine findings into a prioritized report.

Report format:

```markdown
## Code Review Summary

### Critical

- [file:line] issue

### High

- ...

### Medium

- ...

### Security

- ...
```

If any CRITICAL findings, do NOT proceed with commit. Suggest fixes.
