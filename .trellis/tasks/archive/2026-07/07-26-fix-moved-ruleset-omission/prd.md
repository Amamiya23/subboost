# Fix moved ruleset omission

## Goal

Keep a preset rule set active after it is moved to another routing target, even
when its original proxy group is disabled or hidden. This lets users remove an
unwanted source group while still routing that rule set through the selected
target.

## Background

- The `github` preset rule set belongs to the `github` / `🐱 代码托管` module.
- Moving it to `select` / `🚀 节点选择` is persisted as a target override on
  `module:github:github`.
- Rule and provider generation currently skip every non-pinned module that is
  absent from `enabledModules`. Therefore disabling the original `github`
  module also drops the moved rule from both `rules` and `rule-providers`, even
  though the move override remains present.
- An explicit `enabled: false` edit represents deletion/disablement of a rule
  and must continue to suppress it.

## Requirements

- R1: A preset module rule with an explicit moved target must be generated when
  its source module is disabled, provided the rule itself is not explicitly
  disabled.
- R2: The moved rule must retain its original provider metadata (`id`,
  `behavior`, and provider path/URL) and use the moved policy target in the
  generated `RULE-SET` row.
- R3: Other unmodified rules from the disabled source module must remain
  omitted; moving one rule must not implicitly restore the source group or its
  sibling rules.
- R4: An explicit `enabled: false` edit must take precedence over a target
  override and omit both the rule and provider.
- R5: Existing behavior for enabled modules, pinned modules, custom rule sets,
  and rule ordering must remain compatible.

## Acceptance Criteria

- [x] With `github` absent from `enabledModules` and
  `builtinRuleEdits["module:github:github"].target` set to `🚀 节点选择`, the
  generated providers contain `github` with the `geosite/github.mrs` source.
- [x] The same configuration contains exactly one
  `RULE-SET,github,🚀 节点选择` row.
- [x] `gitlab` and `atlassian` are not generated merely because `github` was
  moved out of their disabled source module.
- [x] If the moved `github` edit also has `enabled: false`, neither its provider
  nor its `RULE-SET` row is generated.
- [x] Focused core generator tests and the relevant package test suite pass.

## Out of Scope

- Automatically disabling or hiding an emptied source proxy group.
- Changing the UI interaction or the persisted `BuiltinRuleEdits` schema.
- Changing targets for pinned routing modules.
