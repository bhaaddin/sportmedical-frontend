# Security

## Reporting a problem
Write to the owner (not a public issue) with what you saw, where, and how to repeat it. Do not include real patient or customer data in the report.

## Rules every change keeps
- No secrets in git: keys, passwords and tokens live in the host's environment or secret store. A secret that was committed is treated as leaked and rotated, even if the commit is deleted.
- Personal identifiers (birth numbers, insurance numbers, e-mail addresses, tokens) never appear in logs, error messages, URLs or screenshots.
- New dependencies: from the official registry, pinned by the lockfile, with a licence compatible with commercial use; run the dependency scan before merging.
- Every route or screen that shows data checks the caller's permission on the server, not only in the UI.
- Production is changed only from a reviewed branch, after the full tests pass, with a backup first.
