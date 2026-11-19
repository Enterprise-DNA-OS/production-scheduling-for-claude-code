# Production Scheduling for Claude Code

Fit the work into the machine time and operator time you actually have. Keep the reasons behind late orders in a database you own.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT licensed. Start with fictional records. | Your shifts, routes, material rules and SkyPlanner data mapping. | Installed through Omni by Enterprise DNA. One setup fee, then a retainer. |
| [Quick start](#quick-start) | [Get your version built](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=skyplanner&utm_medium=customise) | [Book a call](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=skyplanner&utm_medium=managed) |

For factory planners. Works with Claude Code, Codex, OpenCode or Cursor. This base is a deterministic planning desk with daily shifts and explicit resource pairs. It is not a reproduction of SkyPlanner's optimisation engine. [Scope and sources](docs/research.md).

## Quick start

Node 20.6 or later, Windows or Linux:

```bash
npm install
npm run demo
npm test
npm run schedule -- plan --json
npm run view
npm run docs
```

Local PGlite stores data in .data/db. DATABASE_URL selects Postgres. Use a fresh database for real work: migrate, import, verify. Do not seed fictional data into a business database. The demo includes overdue brackets, a two-step frame route, a held lathe, missing stock and a planned press shutdown. Seed dates are relative to first use and repeated seeds preserve changes.

## Five weekly jobs

1. /dispatch: allocate both machine and operator minutes, without double booking.
2. /late-orders: explain blocked work and proposed late finishes.
3. /capacity: see the backlog against recorded working minutes.
4. /compliance: check holds, review evidence and material readiness.
5. /weekly-review: combine the proposed plan, resource load and checks.

The scheduler orders batches by earliest deadline, then respects each batch's operation sequence. It splits work across weekday shifts starting at 08:00. Defaults are 480 minutes per resource, configurable downwards. Shutdowns, missing evidence and expired reviews remove capacity. This heuristic is transparent, not an optimality guarantee. A proposed schedule does not release machinery or confirm delivery. [CLI](docs/cli.md).

## Ten questions to ask from your own records

These combine your local rules and evidence. They are not claims that SkyPlanner cannot answer similar questions.

1. Which overdue batch gets the shared milling cell first? (plan)
2. Which press step must wait for milling to finish? (dispatch)
3. Which orders cannot run because a resource is held? (late-orders)
4. Which material checks still block production? (compliance)
5. Which operator has more queued minutes than a working day? (capacity)
6. Which operations have deadlines before their ready time? (compliance)
7. Which machine reviews are overdue? (compliance)
8. What happens to delivery when tomorrow is a shutdown? (plan)
9. Which original imported row supplied an operation? (record)
10. Who recorded a hold release or material confirmation? (history)

## Your first hour: ten things to ask for

1. Register our machines and their shift minutes.
2. Register our operators and competence evidence.
3. Import our planning sheet in a test run.
4. Match the imported counts to the source.
5. Confirm material readiness for one batch.
6. Record a machine shutdown tomorrow.
7. Show the proposed dispatch slots.
8. Explain every blocked or late order.
9. Put our business name and logo in brand.json.
10. Add our second-shift rule through /customise.

## Move from SkyPlanner

`npm run schedule -- import skyplanner imports/schedule.csv --actor=Planner --dry-run` validates the vendor's published production schedule template format in one command. Repeat without --dry-run to load it. This format is a public planning template, not a verified one-click account export. Full account history requires mapping from the documented API or your ERP exports. New resources remain held and materials unconfirmed until a person checks them. [Switching guide](docs/replace-skyplanner.md).

## Outputs and operation

npm run docs creates routing cards and resource capacity reviews as branded HTML. npm run view creates the production-week snapshot. /draft-dispatch writes a local proposal, never sends. Export writes all five record sets with source payloads and immutable history to a new JSON file. This is an interchange snapshot, not automatic restore; back up the database and evidence files separately.

npm test uses a temporary database and checks resource conflicts, route order, closures, holds, late work, atomic imports, repeated imports, history, HTML escaping and every CLI command. A manual workflow covers Linux, Windows and Postgres 16. Postgres can be tested with a fresh TEST_DATABASE_URL. Public schema access is revoked. Shared deployment needs authenticated scoped roles and tested backups.

MIT licensed. Not affiliated with SkyPlanner or Anthropic. Hosting and coding-agent costs are separate. [30 minutes with Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=skyplanner&utm_medium=readme).
