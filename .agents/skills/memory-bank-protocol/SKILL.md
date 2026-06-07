---
name: memory-bank-protocol
description: Pointer to the vibe suite's shared Memory Bank protocol, which is centralized in vibe-common. Read that skill for how to boot and close sessions.
---

# Memory Bank Protocol (pointer)

The Memory Bank for the entire vibe-* suite is **centralized in `vibe-common`**,
not in this module. The full protocol — boot order, session-closing steps,
frontmatter schema, and conventions — lives there:

- **Skill:** `../vibe-common/.agents/skills/memory-bank-protocol/SKILL.md`
- **Bank:** `../vibe-common/memory-bank/` (start at its `AGENTS.md`)

(Paths are relative to this module's root; `vibe-common` sits beside this
module under `Foundry VTT/Data/modules/`.)

## Quick reference

- **Boot (session start):** read `../vibe-common/memory-bank/AGENTS.md` → the
  most recent `logs/` entry → relevant `projects/*/AGENTS.md` → search
  `knowledge/` by tag (filter `module: vibe-actor` for this module's notes).
- **Close ("finish session"):** update today's `logs/` entry, touched
  `projects/*/AGENTS.md`, and any new gotcha in `knowledge/`; bump `modified:`
  dates after verifying the real system date.

Read the central skill for the authoritative details.
