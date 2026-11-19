---
description: Preview and import the SkyPlanner production schedule CSV format.
---
# import
Read CLAUDE.md and docs/cli.md. Preview and import the SkyPlanner production schedule CSV format.
Run `npm run schedule -- import --json`, adding the required arguments in docs/cli.md.
Use import skyplanner <csv-file> --actor=<operator> --dry-run first, then repeat without --dry-run after checking counts. Read docs/replace-skyplanner.md.
Show actual returned records. List ambiguity and resolve it before writing. Never send or operate machinery. Generated plans and drafts remain local.
