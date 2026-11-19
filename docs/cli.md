# Command reference

Use npm run schedule -- <command>. Flags use --key=value. Append --json for structured output. All times are factory-local calendar values with no timezone conversion. Dates use YYYY-MM-DD; timestamps use YYYY-MM-DD HH:MM. Default plan start is today's UTC date; set --start to the factory date explicitly.

Read commands: resources, operations, capacity, compliance, overdue, closures, history, attention, weekly-review. record <code-or-id-prefix> returns one operation. Matching is case-insensitive for exact code or name, with partial UUIDs; ambiguous names list candidates and exit 1.

plan, dispatch and late-orders accept --start=YYYY-MM-DD and --horizon=90 (1 to 365). plan returns rows and contiguous work slots. --save --actor=Name saves an immutable proposal with the input fingerprint. Replan after every change; saved proposals are historical, never a dispatch authority. dispatch returns slots, late-orders returns late and blocked rows. Late minutes are elapsed calendar minutes, not working minutes.

## Record changes

Every write needs --actor=Name. --dry-run executes validation then rolls back.

- add-resource --code=M1 --name=Mill --kind=machine --minutes=480. Kind is machine or operator. Starts held.
- set-resource M1 --hold=false --evidence=Inspection-123 --review=2027-01-31 --minutes=420. Release needs current evidence and review date. A review date is set by your policy, not a statutory interval.
- add-operation --code=A-10 --order=A --sequence=10 --machine=M1 --operator=O1 --setup=30 --run=120 --ready="2026-12-01 08:00" --due="2026-12-02 16:00" --material=true. Durations are whole minutes. Each route sequence is unique within its order.
- set-operation A-10 --material=true --ready="2026-12-01 09:00" --due="2026-12-03 16:00". To finish: --status=done --reason=Completion-record. To cancel: --status=cancelled --reason=Reason. Earlier planned steps must be completed or cancelled first. Closed operations cannot be edited.
- close-day M1 --date=2026-12-02 --reason=Maintenance. Blocks the whole shift. Corrections require a reviewed migration; no delete shortcut.
- log A-10 --note="Waiting for stock confirmation". Appends a history entry.
- import skyplanner <file.csv>. Read the switching guide. A changed source row is rejected, never silently applied over a local correction.

## Local files

export <new-file.json> writes all records and refuses overwrite. draft-dispatch --start=YYYY-MM-DD writes under drafts/. OUTPUT_DIR redirects generated artifacts. npm run docs renders routing cards and resource reviews; npm run view renders the week. Never send these files automatically.

## Planning limits

Single machine and operator per step; no alternative-resource solver, parallel batch processing, overtime, quantity-based material allocation or skill matching. Each operation consumes its recorded setup plus run minutes once. Splitting across shifts does not add repeat setups. Cancelled steps are skipped; done steps are treated as already complete. A blocked step blocks its successors. Imported source End values are retained as evidence, not used as feasible finish times. Extend these rules for the factory before replacing its existing planning system.
