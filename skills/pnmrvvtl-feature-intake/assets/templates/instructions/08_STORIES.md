# Stories

## Dependency Rules

- Epics are containers only.
- Never put an Epic key or tempId in `blockedBy`.
- Use `blockedBy` only for concrete Story/Bug execution dependencies.
- Prefer fewer dependencies.
- Use `integrates` only when parallel story outputs must be combined.
- Each Story must be <= 5 points.

## Epic <KEY-0>: <Name>

### <KEY-001> <Story Name>

- Points: <1-5>
- Status: Backlog
- Goal: <User/business outcome.>
- Scope: <Concrete implementation scope.>
- Acceptance: <AC ids.>
- Design Reference: <Design screen anchors/screenshots, or "Draft - awaiting design package".>
- Dependencies: <blockedBy/integrates or none.>
- Verification: <Exact checks and scenarios.>
