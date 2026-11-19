# Evidence checks before dispatch

This tool checks recorded planning evidence. It does not certify machinery safety or legal compliance, and cannot inspect guards, verify qualifications or release an isolation. A competent person remains responsible for the work.

Sources checked 2026-11-19:
- WorkSafe NZ, Safe use of machinery: https://www.worksafe.govt.nz/topic-and-industry/machinery/safe-use-of-machinery/
- WorkSafe NZ, Keeping workers safe with machine lockouts: https://www.worksafe.govt.nz/topic-and-industry/machinery/keeping-workers-safe-with-machine-lockouts/

SAFE-01 excludes resources with a recorded hold. This supports the separation of maintenance/isolation work from production proposals. The database flag is not a physical lockout.

SAFE-02 flags missing evidence or expired review dates for machines and operators. WorkSafe guidance addresses inspection, maintenance and worker training. The review date and daily capacity are local policies chosen by the business, not statutory periods. A plan excludes days after the resource review expires.

MAT-01 requires explicit material readiness for each planned operation. It is an internal planning rule, not a law or proof of stock availability.

DATA-01 flags due dates before ready dates. This is an internal data check. Do not conceal an overdue promise by moving its due date without the operator's instruction.

The scheduler also prevents simultaneous allocation of a machine or operator, respects closures and orders steps by routing sequence. Those are planning checks only. Australian operators must map their own jurisdiction, procedures and evidence requirements before use.
