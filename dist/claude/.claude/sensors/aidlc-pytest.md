---
id: pytest
kind: deterministic
command: bun .claude/tools/aidlc-sensor-pytest.ts
default_severity: advisory
description: Runs the project's pytest suite + coverage floor; fires on Python writes and surfaces failing tests / coverage gaps as SENSOR_FAILED at the stage gate.
category: test-quality
matches: "**/*.py"
input_schema:
  file_path: string
output_schema:
  pass: boolean
  failures:
    - test: string
      message: string
  coverage_pct: number
timeout_seconds: 120
---

# pytest sensor

The advisory / governance layer. It rides v2's existing rail: it fires on
`Write|Edit` via `aidlc-sensor-fire.ts` (PostToolUse) once you add `pytest` to a
stage's `sensors:` frontmatter (which the graph builder lifts into that stage
node's `sensors_applicable`). Because sensor-fire is PostToolUse and "always
exit 0", this sensor CANNOT block — it records evidence. The hard gate is the
`aidlc-tdd-guard.ts` PreToolUse hook; this sensor is what re-runs the suite at
the stage boundary so the human sees test evidence at the approval gate.

## Tool contract

`aidlc-sensor-pytest.ts` MUST match the stdout/exit-code contract of your pinned
version's shipped sensor scripts — copy `core/tools/aidlc-sensor-type-check.ts`
as the template (it documents the dispatcher's 127 tool-unavailable branch, the
"pass"/findings JSON shape, and the detail-file write). Swap its `tsc` invocation
for `python -m pytest --cov=<pkg> --cov-report=term-missing` and parse the TOTAL
line for the coverage percentage. Keep the same exit semantics so
`aidlc-sensor.ts` routes it correctly.

## Failure mode

Emits `SENSOR_FAILED` and writes detail to
`aidlc-docs/.aidlc-sensors/<stage-slug>/pytest-<fire-id>.md` with failing test
names/assertions and coverage total vs floor (`aidlc-docs/.tdd/config.json`).
