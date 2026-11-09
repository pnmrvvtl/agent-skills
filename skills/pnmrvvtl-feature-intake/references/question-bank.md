# Question Bank

Use these areas to find blocker questions. Ask only questions that change the plan or remove a risky unknown.

## Product

- What user problem is solved?
- Who is the primary audience?
- What is the success criterion for v1?
- What is explicitly out of scope?
- What existing flow must not regress?

## Access

- Which roles/plans can see and use it?
- What is free vs paid?
- What happens for anonymous users?
- What backend enforcement is required?

## Data

- What data is created, read, updated, deleted?
- Is data local-only, remote-only, or offline-first sync?
- What records need migration/backfill?
- What import/export or retention rules exist?

## UI

- What screens, panels, modals, and states exist?
- What empty/loading/error/offline states are required?
- What responsive breakpoints matter?
- What controls and navigation paths are expected?

## Integration

- Which existing routes, stores, APIs, tables, functions, or jobs are touched?
- What current behavior must remain unchanged?
- What feature flags or rollout behavior are needed?

## QA

- What unit tests prove business logic?
- What integration tests prove contracts/data flow?
- What browser/emulator/Maestro flows prove user behavior?
- What edge cases must be explicitly tested?

## Blocking Rule

Block doc generation for missing decisions that affect user-visible behavior, security, data contracts, pricing/access, migrations, or acceptance criteria. Record minor defaults as assumptions.
