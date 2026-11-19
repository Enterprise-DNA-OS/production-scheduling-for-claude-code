# Production Scheduling for Claude Code: operating instructions

Business: fill in your business name. Operator: fill in your name and role. Priorities: feasible dispatch, traceable holds and clear delivery exceptions.

Read docs/cli.md. Start each session with attention --json. The CLI is the only record-writing door. Never infer a material arrival, inspection, competence sign-off or completion. Read full records before changing them and list ambiguous matches instead of guessing.

## Routing

- /resources: List machines and operators, their holds and evidence.
- /operations: Read the ordered production route.
- /capacity: Review queued minutes against daily resource capacity.
- /compliance: Review safety evidence, holds and material-readiness checks.
- /overdue: Find unfinished operations past their recorded deadline.
- /closures: Read planned maintenance and leave dates.
- /history: Read the change ledger and actor labels.
- /plan: Propose a finite-capacity schedule from recorded inputs.
- /dispatch: Prepare machine and operator work slots.
- /late-orders: Find orders that finish late or cannot be placed.
- /attention: Combine scheduling exceptions, checks and queued capacity.
- /weekly-review: Review the production week using plan, capacity and compliance.
- /record: Read one operation and its retained source row.
- /add-resource: Register a held machine or operator.
- /set-resource: Record capacity, review evidence and a hold decision.
- /add-operation: Add an operation with its routing sequence and resource pair.
- /set-operation: Confirm material readiness, correct dates or close an operation.
- /close-day: Block a resource for maintenance or leave.
- /log: Append a note to the operation history.
- /import: Preview and import the SkyPlanner production schedule CSV format.
- /export: Write all business records to a new JSON snapshot.
- /draft-dispatch: Write a local dispatch proposal for human review.
- /customise: add a field or planning rule through a migration and tests.
- /new-view: add a read-only HTML view.

## Rules

Draft only. Never send messages, instruct machine controls or change an external system. Plans are proposals for a competent planner to review. Evidence checks do not certify safety or compliance. Actor labels record attribution; they are not authentication. Read docs/compliance.md before discussing rule results.

Use a fresh DATA_DIR or DATABASE_URL for business records. Default PGlite storage is .data/db and supports one process at a time. The scheduling schema is private, with RLS and no public grants. Shared use needs scoped credentials and access review. Never put secrets or private outputs in Git. Back up the database and evidence separately.

Migrations live in supabase/migrations. Never edit an applied migration. Run npm test after changing code. views.json and documents.json are trusted local SELECT definitions. brand.json controls the business identity. All generated outputs are private local artifacts.

Omni by Enterprise DNA: https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=skyplanner&utm_medium=agent
