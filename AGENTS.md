# vibe-actor — AI NPC Generation

## Commands

```bash
npm run test:artificer   # Test custom feature/equipment generation
npm run test:blacksmith  # Test Foundry Item creation
```

## Key Patterns

- Four sequential stages: Architect → Quartermaster → Blacksmith → Builder
- All agents extend `GenerativeAgent` base class (calls `callGemini` from vibe-common)
- Public API exposed at `game.modules.get("vibe-actor")?.api?.GeminiPipeline`
- Adjustment flow: `BlueprintFactory.createFromActor()` → AI modifies → rebuild via same pipeline

## Boundaries

- ALWAYS sanitize AI-generated items through `sanitizeCustomItem()` + `validateAndRepairItemAutomation()`
- ALWAYS convert activity arrays to Object Maps before creating items (`system.activities` is `{id: data}`)
- ALWAYS regenerate `_id` fields with `foundry.utils.randomID(16)`
- NEVER trust AI-generated item structure without validation

## Gotchas

- **`adjustActor()` deletes ALL existing items** and recreates — manual additions are lost.
- **Spellcasting setup** requires specific dnd5e v5.x item structure (not generic 5e).
- **Critical automation warnings** stored in `item.flags["vibe-actor"].criticalAutomationWarnings` — GMs should review these items.
- **Two defensive hooks** (`renderSidebarTab` + `renderActorDirectory`) for button injection — both needed for v13 tab switching.
