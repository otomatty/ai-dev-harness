# Python TDD (Iron Law) — developer-agent knowledge

Load this whenever you implement any Python feature or bugfix in the
`tdd-construction` stage. It adapts the red-green-refactor discipline to
pytest and to the `tdd_guard.py` harness that enforces it.

## The rule you cannot talk your way out of

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

The PreToolUse guard will DENY your edit to production `.py` if there is no open
RED cycle. That is not a bug to route around — it is the methodology. If you
find yourself wanting to disable the guard, write a throwaway test, or stub the
module "just to get started", stop: that is the rationalization the guard exists
to catch.

## The loop, concretely

1. **RED — one test.** Pick the next acceptance criterion. Write ONE test that
   asserts the desired behaviour through the real public API you wish existed.
   ```python
   # tests/test_retry.py
   def test_retries_failed_operation_three_times():
       attempts = {"n": 0}
       def op():
           attempts["n"] += 1
           if attempts["n"] < 3:
               raise RuntimeError("fail")
           return "ok"
       assert retry(op) == "ok"
       assert attempts["n"] == 3
   ```
2. **Prove RED:** `python .claude/tdd_guard.py red tests/test_retry.py`
   - For a brand-new module the first RED is an `ImportError`/`ModuleNotFoundError`
     — that is a legitimate "feature missing" failure and the guard accepts it.
   - For a new behaviour on an existing module, aim for an assertion failure.
   - If the guard says the test PASSED, you are testing existing behaviour.
     Rewrite it.
3. **GREEN — minimal code.** Write the least code that passes. No `**kwargs` you
   don't need, no config options, no base classes for one implementation.
   ```python
   def retry(fn, attempts=3):
       for i in range(attempts):
           try:
               return fn()
           except Exception:
               if i == attempts - 1:
                   raise
   ```
4. **Prove GREEN:** `python .claude/tdd_guard.py green` — full suite + coverage
   floor. If red, fix the CODE, never the test. On green the cycle closes and
   production edits re-lock.
5. **REFACTOR** while green, then commit. One behaviour per commit.

## pytest specifics

- Name tests for the behaviour: `test_rejects_empty_email`, not `test_1`. One
  behaviour per test — an "and" in the name means split it.
- Prefer real objects over mocks. Reach for `monkeypatch`/fakes only at true
  boundaries (network, clock, filesystem). A test that only asserts on a mock is
  testing the mock, not your code.
- Use `pytest.raises` for error paths, `pytest.mark.parametrize` for input
  tables — but each parametrized case must still be one clear behaviour.
- Keep the run clean: no stray warnings or prints. A noisy green is a smell.

## Anti-patterns the reviewer will reject

- **Trivial RED to unlock edits.** Writing `assert False` or a test with no real
  assertion, just to open a cycle. The reviewer reads your tests; a RED whose
  assertion doesn't correspond to a real acceptance criterion is a rejection.
- **Testing implementation, not behaviour.** Asserting that a private helper was
  called instead of asserting the observable result.
- **Test-only methods on production classes.** If a test needs a hook, that is a
  design signal — inject a dependency, don't add `_for_testing()` to prod code.
- **Coverage theatre.** Adding a test that executes a line without asserting
  anything meaningful about it, purely to clear the floor.

## Bug fixes

Reproduce the bug as a failing test FIRST (`red`), then fix (`green`). The test
proves the fix and prevents regression. Never fix a bug without a test.

## When a test is hard to write

Hard-to-test usually means hard-to-use. If setup is enormous or you must mock
everything, the design is too coupled — simplify the interface or inject
dependencies before continuing. Ask the human partner rather than forcing it.
