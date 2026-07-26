# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

Core generators must apply the same inclusion contract to every section that
references a rule. In particular, `rules` and `rule-providers` must not derive
their scope independently.

## Scenario: Preset Rule Moved Out of a Disabled Source Module

### 1. Scope / Trigger

Applies when changing preset rule movement, module enablement, builtin rule
edits, rule ordering, or Clash `rules` / `rule-providers` generation.

### 2. Signatures

```ts
isModuleRuleInGenerationScope(
  module: ProxyGroupModule,
  ruleId: string,
  enabledModules: ReadonlySet<string>,
  builtinRuleEdits?: BuiltinRuleEdits,
): boolean
```

Both `buildCanonicalRuleEntries` and `generateRuleProviders` consume this
shared scope decision.

### 3. Contracts

- A pinned module rule is always in generation scope.
- A rule from an enabled source module is in generation scope.
- A rule from a disabled source module is in scope only when its builtin edit
  has an explicit `target`; sibling rules stay out of scope.
- `BuiltinRuleEdit.enabled === false` suppresses actual rule and provider
  output even when a moved target keeps the rule in ordering scope.
- The provider keeps the preset rule's original id, behavior, and path; only
  the generated `RULE-SET` policy target changes.

### 4. Validation & Error Matrix

| State | `rules` | `rule-providers` |
| --- | --- | --- |
| Source enabled, no edit | Include | Include |
| Source disabled, no edit | Omit | Omit |
| Source disabled, target edit | Include with moved target | Include original provider |
| Source disabled, target edit plus `enabled: false` | Omit | Omit |

### 5. Good / Base / Bad Cases

- Good: disabled `github` module plus a `module:github:github` target edit
  emits only the GitHub rule and provider.
- Base: enabled `github` module emits GitHub, GitLab, and Atlassian presets.
- Bad: treating module disablement as a blanket filter drops a moved GitHub
  rule, or restores its unmodified siblings.

### 6. Tests Required

- Unit-test the shared generation-scope helper for enabled, disabled, moved,
  and pinned cases.
- Regression-test the assembled Clash config and assert the moved `RULE-SET`
  row exists exactly once, its provider URL is preserved, siblings are absent,
  and `enabled: false` removes both outputs.

### 7. Wrong vs Correct

```ts
// Wrong: drops every moved rule whose original module was disabled.
if (!enabledModules.has(module.id)) continue;

// Correct: scope is evaluated per rule and shared by both output sections.
if (!isModuleRuleInGenerationScope(module, rule.id, enabledModules, edits)) continue;
```

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

- Keep rule inclusion logic in `generator/module-rules.ts` and reuse it across
  all generated config sections.

---

## Testing Requirements

- Generator bug fixes require an assembled-config regression test, not only a
  helper unit test.

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
