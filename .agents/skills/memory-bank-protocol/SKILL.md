---
name: memory-bank-protocol
description: The Brain. Core protocols for reading, writing, and maintaining the project's Memory Bank and global directives.
---

# Memory Bank Protocol (The Brain)

**Last Updated:** 2026-02-22

This skill governs how the Agent (You) interacts with the project's long-term memory system and defines the core operational rules.

## 🧠 Memory Bank Architecture

The **Memory Bank** is your single source of truth. It persists context between sessions. **You have NO other memory.**

### Location
`vibe-common/memory-bank/` (Located specifically in the `vibe-common` module, not your current working module)

### Core Files (Reading Order)
When starting a task or session, you MUST read these files in order to "boot up" your context. Remember to look in the `vibe-common` module:

1.  **`vibe-common/memory-bank/core/current-state.md`**: 🎯 **THE NOW**. What is happening, active phase, tasks.
2.  **`vibe-common/memory-bank/core/projectbrief.md`**: 📋 **THE MISSION**. What we are building and why.
3.  **`vibe-common/memory-bank/core/productContext.md`**: 👥 **THE USER**. Who we are selling to.
4.  **`vibe-common/memory-bank/technical/techContext.md`**: 🔧 **THE TOOLS**. Stack versions and config.
5.  **`vibe-common/memory-bank/technical/systemPatterns.md`**: 🏗️ **THE PATTERNS**. Architecture rules.
6.  **`vibe-common/memory-bank/core/progress.md`**: 📊 **THE HISTORY**. What has been done.
7.  **`vibe-common/memory-bank/NOTES_NEXT_SESSION.md`**: 📝 **THE HANDOVER**. Specific instructions for this session.

## 📋 Operational Protocols

### 1. English Only Code
*   **Code/Comments:** 100% English. No exceptions.
*   **UI/Content:** 100% English (MVP).
*   **Variable Names:** English (e.g., `getFlow`, not `obtenerFlujo`).

### 2. English Communication
*   **Chat/Reasoning:** 100% English.
*   **Memory Bank Files:** 100% English.

### 3. Date Verification (CRITICAL)
Before modifying ANY documentation file (Memory Bank, Docs, Skills):
1.  **Check System Date:** Run `date` or check system time tool.
2.  **Update Metadata:** Always update `**Last Updated:** [YYYY-MM-DD]` fields.
3.  **NEVER ASSUME DATES.**

### 4. Session Closing Protocol
When the user says "finish session" or similar:
1.  **Update `current-state.md`**: Reflect the latest status.
2.  **Update `progress.md`**: Log completed milestones.
3.  **Update `NOTES_NEXT_SESSION.md`**: Write clear instructions for the "next you".
4.  **Cleanup**: Remove temp files or logs.

## 🚀 Self-Improvement Directive (The "Gardener")

You are responsible for maintaining and evolving your own Skills.
When you discover a new pattern, solution, or rule:
1.  **Identify the relevant Skill:** (e.g., `modern-stack-engineering` for a Drizzle pattern).
2.  **Update the `SKILL.md`:** Add the knowledge directly to the file.
3.  **Refactor:** If a Skill becomes too large, propose splitting it.
4.  **Create:** Only create a NEW Skill folder if the knowledge is truly domain-distinct (e.g., Mobile Development).

**DO NOT create loose files for rules. Curate your `vibe-common/.agents/skills` folder.**
