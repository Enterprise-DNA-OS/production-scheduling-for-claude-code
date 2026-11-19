---
description: Change a field or planning rule with a reversible migration.
---
# Customise
Read CLAUDE.md and the relevant migration and CLI. Clarify the requested field, routing rule or shift change. Back up the database. Write a new numbered migration, never edit one already applied. Update the CLI, documents and a behaviour test. Run npm test on an isolated database, apply the migration, then read the resulting record. Safety evidence is supplied by the operator, never inferred. Keep existing history and source payloads.
