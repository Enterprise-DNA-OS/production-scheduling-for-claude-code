# Target research, 2026-11-19

SkyPlanner, production-scheduling family. Registry scan found no existing target in this family. Job costing, stock planning and workforce rostering already exist and are distinct from routing operations through paired machine/operator capacity.

Vendor price: https://skyplanner.ai/pricing/
EUR 199 per month includes five workstations; each additional workstation is EUR 20 per month. Fifty workstations calculate to EUR 13,188 per year: (199 + 45 x 20) x 12. This is a modelled list-price scenario, not an actual ANZ invoice. Tax and separately scoped integration work are excluded. No local customer usage or all-in bill was established from the available customer records.

Scores in charter order: annual bill 2, data-shaped 5, buyer fit 2, search demand 2, session buildability 4, import 4. Total 19/30. Search results establish relevant comparison listings, not keyword volume. Buyer fit is an industry hypothesis, not evidence of a customer running SkyPlanner.

Other candidates: frePPLe 1,4,2,2,3,5 = 17/30. Its current subscription figure was not exposed in the pricing page and it is already open source: https://frepple.com/pricing/. Orderful was excluded because trading-network connectivity is central: https://www.orderful.com/pricing/.

Import is grounded in the published production schedule template, not a claimed native account CSV export. The full API schema is documented by SkyPlanner and can be mapped for customers: https://skyplanner.ai/docs/api-v4-basic-integration/.

This project implements an original earliest-due-order heuristic with fixed paired resources. It does not reproduce the incumbent's optimisation, live production tracking, integration platform or material-allocation engine. No claim is made that SkyPlanner cannot answer the ten local questions. Those are demonstrations of what this base can answer from its own records.
