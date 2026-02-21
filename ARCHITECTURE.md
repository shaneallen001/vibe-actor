# Vibe Actor Architecture & Developer Guide

This document is intended for AI agents and human developers working on the `vibe-actor` module. Complete usage details are in [README.md](./README.md).

## 1. Module API & Extensibility

Vibe Actor exposes its core pipeline as a public API during the `init` hook, allowing other modules (like `vibe-combat`) to programmatically generate and adjust actors without duplicating code.

```javascript
// Access the pipeline
const GeminiPipeline = game.modules.get("vibe-actor")?.api?.GeminiPipeline;

if (GeminiPipeline) {
    const pipeline = new GeminiPipeline(geminiApiKey);
    const actorData = await pipeline.generateActor({ 
        prompt: "A fiery goblin boss",
        cr: 2
    });
}
```

## 2. Entry Point & Hooks (`scripts/main.js`)

```
Hooks.once("init")                    → Checks for `vibe-common` dependency; aborts and notifies if missing
Hooks.once("ready")                   → Validates dnd5e system, calls registerActorModuleSettings()
Hooks.on("renderSidebarTab")          → Injects "Vibe Actor" button when actors tab is active
Hooks.on("renderActorDirectory")      → Also injects button (defensive, covers v13 tab switching)
Hooks.on("getHeaderControlsApplicationV2") → Adds "Vibe Image" and "Vibe Adjust" buttons
                                             to ActorSheetV2 headers (GM only)
```

## 3. The NPC Generation Pipeline (`services/gemini-pipeline.js`)

`GeminiPipeline` is the core orchestrator for actor generation. It runs four sequential AI/async stages:

```
GeminiPipeline.generateActor(request)
  │
  ├─ 1. ArchitectAgent.generate(request)
  │       Receives: { prompt, cr, type, size }
  │       Returns:  Blueprint JSON (name, stats, features[], spells[], equipment[], languages[], etc.)
  │
  ├─ 2. QuartermasterAgent.generate(context)
  │       Receives: { blueprintFeatures[], candidates{} }
  │         → For each feature, CompendiumService.search() returns top 3 compendium matches
  │       Returns:  { selectedUuids[], customRequests[] }
  │         → selectedUuids: items sourced from compendiums
  │         → customRequests: items that must be AI-fabricated
  │
  ├─ 3. BlacksmithAgent.generate(context)
  │       Receives: { creatureName, cr, stats, requests[] }
  │       Returns:  Array of Foundry Item document objects
  │         → Converts activities from Array → Object Map (required by dnd5e v4+)
  │         → Regenerates all _ids with foundry.utils.randomID(16)
  │
  └─ 4. runBuilder(blueprint, selectedUuids, customItems)
          → Fetches compendium items via fromUuid()
          → Runs sanitizeCustomItem + validateAndRepairItemAutomation on each custom item
          → SpellcastingBuilder.build(blueprint) creates a spellcasting feat + embedded spells
          → Assembles final actor document: { name, type, system{}, items[], prototypeToken{} }
```

**Actor Adjustment Flow** (`GeminiPipeline.adjustActor(actor, prompt)`):
```
BlueprintFactory.createFromActor(actor)  → Extracts current state into a Blueprint
AdjustmentAgent.generate({ original, prompt }) → Produces a modified Blueprint
→ Then runs Quartermaster → Blacksmith → Builder (same as generation)
→ actor.deleteEmbeddedDocuments("Item", ...) + actor.update() + actor.createEmbeddedDocuments()
```

## 4. Agent Pattern (`agents/generative-agent.js`)

All agents extend `GenerativeAgent`. Each agent defines:
- `get systemPrompt()` — The persona/instructions prefix sent to Gemini
- Calls `callGemini({ apiKey, prompt, responseSchema })` from `vibe-common`
- If `responseSchema` is provided, Gemini uses constrained JSON mode (`response_mime_type: "application/json"`)

## 5. Item Sanitization & Repair (`utils/item-utils.js`)

After the Blacksmith generates Item JSON, these functions run on each item:
- `sanitizeCustomItem(item)` — Strips invalid fields, normalizes structure
- `validateAndRepairItemAutomation(item)` — Checks dnd5e activity model correctness, auto-repairs common issues, returns `{ item, warnings[] }`
- `ensureActivityIds(item)` — Guarantees all activities have valid 16-char IDs
- `ensureItemHasImage(item)` — Looks up icon in compendium or assigns a default
- `normalizeMutuallyExclusiveOptionItems(items)` — Fixes "choose one option" features that should be separate activities

**Critical automation warnings** are stored in `item.flags["vibe-actor"].criticalAutomationWarnings` so GMs can review items that may need manual adjustment.

## 6. Common Gotchas
- **dnd5e v4+ activity model**: Foundry dnd5e 5.x uses `system.activities` as an Object Map (`{ id: activityData }`), NOT an array. Gemini outputs arrays (easier for the model), so `BlacksmithAgent.generate()` converts them before returning.
- **Item `_id` collisions**: Never trust AI-generated `_id` values. Always regenerate with `foundry.utils.randomID(16)`.
- **Adjustment replaces all items**: `adjustActor()` deletes all existing items and recreates them. This means any manually-added items on the actor will be lost after adjustment.
