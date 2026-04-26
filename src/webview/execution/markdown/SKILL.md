---
name: skills
description: Behavioral guidelines that reduce common coding mistakes — overengineering, scope creep, hidden assumptions, vague success criteria. Use when implementing a feature, fixing a bug, refactoring, reviewing a diff, or before any non-trivial code change. Especially when the request is vague ("clean this up", "make it better") or the scope is unclear.
---

# Coding Discipline

Behavioral guidelines to reduce common coding mistakes.

**Tradeoff:** These bias toward caution over speed. For trivial edits (typos, one-line tweaks, throwaway scripts), use judgment and skip the ceremony.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Test: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that *your* changes made unused.
- Don't remove pre-existing dead code unless asked.

Test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

    1. [Step] → verify: [check]
    2. [Step] → verify: [check]
    3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Examples of when this skill applies

- "Add OAuth login" → state assumptions about provider, token storage, session handling before coding.
- "Refactor the user service" → ask what success looks like; don't restructure speculatively.
- "Fix this flaky test" → reproduce first, then minimal fix; don't rewrite the whole test file.
- "Make the API faster" → ask which endpoints, what targets, what to measure.