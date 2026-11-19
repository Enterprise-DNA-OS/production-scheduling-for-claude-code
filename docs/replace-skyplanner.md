# Bring a SkyPlanner planning sheet across

Source checked 2026-11-19: https://skyplanner.ai/resources/production-schedule-template/
Template: https://skyplanner.ai/wp-content/uploads/2026/10/production-schedule-template.csv
API model: https://skyplanner.ai/docs/api-v4-basic-integration/

The tested file is SkyPlanner's public production schedule template. It is not a promise that a SkyPlanner account has a matching export button. For a full account migration, an authorised administrator obtains all pages of API records or exports from the connected ERP; map them to this format and reconcile before import. This repo makes no network calls and handles no vendor credentials.

Required columns: Order / operation, Machine / operator, Setup min, Run min, Start, End, Due, Status. Codes use a slash separator in the first two columns. Operations must end in a numeric routing suffix, such as FRAME-10 then FRAME-20. Use unique operation codes across orders and distinct machine/operator codes. Status must be Planned. Dates use factory-local YYYY-MM-DD HH:MM. Durations are whole minutes.

1. Save the planning sheet as UTF-8 comma-separated CSV. Keep its original copy separately. The vendor example in tests/fixtures is recreated with fictional records in the same documented format.
2. Migrate an empty database. Run npm run schedule -- import skyplanner imports/schedule.csv --actor=Planner --dry-run.
3. Check the record count, resource names, routing sequences, deadlines and durations. Repeat without --dry-run to commit the entire file atomically.
4. Record resource evidence and review dates with set-resource, then confirm materials using set-operation. Resources begin held and material readiness begins false. No import declares a machine safe.
5. Run plan, compliance and dispatch. Compare your real route and capacity before using the proposals. Keep the old service while custom shifts, integrations and history are being mapped.

Same-file imports are idempotent. Duplicate rows, malformed dates and changed source rows fail the whole batch. Corrections use explicit record changes. Original row payloads and hashes remain available through record and export.

Full account history, attachments, existing schedule placements, material quantities, alternate resources, workforce calendars and vendor optimisation settings do not enter through this template import. Mapping these is part of the customised version. This base does not claim to replace a factory's complete scheduling service in one day.
