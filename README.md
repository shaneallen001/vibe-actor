# Vibe Actor

## Overview
**Vibe Actor** is a Foundry VTT module that leverages AI to generate, adjust, and visualize NPCs. It is part of the Vibe Project ecosystem.

## Features

### 1. AI Actor Generation
-   **Prompt-Based Creation**: Generate complete NPC statistics, biography, and features from a simple text prompt.
-   **CR & Type Support**: Specify Challenge Rating, Creature Type, and Size to guide the generation (e.g., "CR 5 Fire Elemental").
-   **Feature Integration**: Automatically generates structured data for `dnd5e` features, including actions, spells, and special traits.

### 2. Actor Adjustment
-   **Modify Existing NPCs**: Select an actor and use AI to adjust specific aspects (e.g., "Make this goblin a shaman" or "Increase CR to 3").
-   **Context-Aware**: The AI understands the actor's current state and applies changes incrementally.

### 3. AI Image Generation
-   **OpenAI DALL-E Integration**: Generate character portraits directly from the actor sheet.
-   **Seamless Workflow**: Images are automatically saved and assigned to the actor's prototype token and sheet image.

## Installation
1.  Ensure **`vibe-common`** is installed and enabled.
2.  Install **`vibe-actor`** into your `Data/modules/` directory.
3.  Enable the module in your Foundry VTT world.

## Configuration
Go to **Settings -> Configure Settings -> Vibe Actor** to set up your API keys:

-   **Gemini API Key**: Required for Actor Generation and Adjustment.
-   **OpenAI API Key**: Required for Image Generation.

> **Note**: If you are migrating from `vibe-combat`, your settings will be automatically migrated upon first launch.

## Usage

### Generating an Actor
1.  Open the **Actor Directory**.
2.  Click the **"Vibe Actor"** button in the header.
3.  Enter a prompt (e.g., "A grim dwarf warmaster with a grudge against elves").
4.  Configure optional parameters (CR, Type, Size).
5.  Click **Generate**.

### Adjusting an Actor
1.  Open an Actor Sheet.
2.  Click the **"Vibe Adjust"** button (usually in the header or near the name).
3.  Enter instructions for the adjustment.
4.  Click **Apply**.

### Generating an Image
1.  Open an Actor Sheet.
2.  Click the **"Vibe Image"** button.
3.  Review the generated prompt (or edit it).
4.  Click **Generate Image**.

---

## Developer Guide

### Module Entry Point & Hooks (`scripts/main.js`)

```
Hooks.once("ready")                   → Validates dnd5e system, calls registerActorModuleSettings()
Hooks.on("renderSidebarTab")          → Injects "Vibe Actor" button when actors tab is active
Hooks.on("renderActorDirectory")      → Also injects button (defensive, covers v13 tab switching)
Hooks.on("getHeaderControlsApplicationV2") → Adds "Vibe Image" and "Vibe Adjust" buttons
                                             to ActorSheetV2 headers (GM only)
```

> **Actor Sheet Buttons**: Foundry v13 uses `getHeaderControlsApplicationV2` to add controls to `ApplicationV2`-based sheets. These push `{ icon, label, action, onClick }` entries to the controls array. Actions are fired by the sheet's own event system.

### Directory Structure

```
scripts/
├── main.js                         # Entry point, hook registration
├── settings.js                     # game.settings.register() calls
├── constants.js                    # Re-exports from vibe-common
├── agents/                         # AI agent wrappers
│   ├── generative-agent.js         # Base class: calls GeminiService, parses structured JSON
│   ├── architect-agent.js          # Stage 1: Designs the NPC blueprint from a prompt
│   ├── blacksmith-agent.js         # Stage 3: Generates custom Foundry Item documents
│   ├── quartermaster-agent.js      # Stage 2: Selects compendium items for each blueprint feature
│   └── adjustment-agent.js         # Adjustment: Rewrites an existing blueprint based on a diff prompt
├── factories/
│   ├── blueprint-factory.js        # Creates blueprints from scratch or from existing actor documents
│   └── actor-blueprint.js          # Blueprint shape definition / defaults
├── libs/
│   └── ...                         # Third-party libraries (if any)
├── schemas/
│   ├── blueprint-schema.js         # JSON schema enforced by Gemini for blueprint output
│   ├── analysis-schema.js          # JSON schema for actor analysis output
│   └── foundry-item-schema.js      # JSON schema for Foundry Item document output
├── services/
│   ├── gemini-service.js           # Re-exports callGemini/extractJson from vibe-common
│   ├── gemini-pipeline.js          # Orchestrates multi-step NPC generation flow
│   ├── compendium-service.js       # Fuzzy text search across compendium packs
│   ├── image-generation-service.js # Calls OpenAI DALL-E, saves image, updates actor
│   └── spellcasting-builder.js     # Converts blueprint spellcasting into dnd5e spellcasting feat
├── ui/
│   ├── actor-button-injector.js    # Injects "Vibe Actor" button into the Actor Directory header
│   ├── image-generator.js          # Dialog wrapper for image generation (calls ImageGenerationService)
│   └── dialogs/
│       ├── vibe-actor-dialog.js    # Main actor generation dialog (form + progress)
│       ├── vibe-adjustment-dialog.js# Adjustment dialog (shows current actor data + prompt field)
│       └── ...
└── utils/
    ├── actor-helpers.js            # mapSkillsToKeys(), getActorCr(), getActorLevel(), etc.
    ├── item-utils.js               # sanitizeCustomItem(), validateAndRepairItemAutomation(), etc.
    └── ...
```

### The NPC Generation Pipeline (`services/gemini-pipeline.js`)

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

### Agent Pattern (`agents/generative-agent.js`)
All agents extend `GenerativeAgent`. Each agent defines:
- `get systemPrompt()` — The persona/instructions prefix sent to Gemini
- Calls `callGemini({ apiKey, prompt, responseSchema })` from `vibe-common`
- If `responseSchema` is provided, Gemini uses constrained JSON mode (`response_mime_type: "application/json"`)

**BlacksmithAgent specifics**: After Gemini returns items, it converts `system.activities` from an Array (easier for AI) to the Object/Map format required by dnd5e v4+ (`{ [activityId]: activityData }`). All `_id` fields are regenerated with `foundry.utils.randomID(16)` to avoid conflicts.

### Compendium Service (`services/compendium-service.js`)
- Searches across all loaded compendium packs for items/feats/spells by name
- Uses simple text matching (case-insensitive substring) with optional type filter (`["feat", "weapon", "spell"]`)
- Returns top N results ordered by relevance

### Spellcasting Builder (`services/spellcasting-builder.js`)
Converts `blueprint.spellcasting` into a proper dnd5e `spellcasting` feat item and a list of embedded spell items. Spells are searched via `CompendiumService` and matched to the blueprint's spell list. If a spell is not found, it is skipped with a console warning.

### Item Sanitization & Repair (`utils/item-utils.js`)
After the Blacksmith generates Item JSON, these functions run on each item:
- `sanitizeCustomItem(item)` — Strips invalid fields, normalizes structure
- `validateAndRepairItemAutomation(item)` — Checks dnd5e activity model correctness, auto-repairs common issues, returns `{ item, warnings[] }`
- `ensureActivityIds(item)` — Guarantees all activities have valid 16-char IDs
- `ensureItemHasImage(item)` — Looks up icon in compendium or assigns a default
- `normalizeMutuallyExclusiveOptionItems(items)` — Fixes "choose one option" features that should be separate activities

**Critical automation warnings** are stored in `item.flags["vibe-actor"].criticalAutomationWarnings` so GMs can review items that may need manual adjustment.

### Image Generation (`services/image-generation-service.js`)
1. Reads actor biography/appearance from the blueprint
2. Builds a DALL-E prompt describing the character
3. Calls OpenAI API (`POST /v1/images/generations`)
4. Saves the returned image to Foundry's data directory via `FilePicker`
5. Updates actor `img` and `prototypeToken.texture.src`

### Settings (`scripts/settings.js`)

| Key            | Type   | Notes               |
| -------------- | ------ | ------------------- |
| `geminiApiKey` | String | GM-only             |
| `openAiApiKey` | String | GM-only, for DALL-E |

### CSS Architecture
- **`styles/vibe-actor.css`**: Actor-specific dialog styles (actor generation, adjustment dialogs).
- **Base tokens**: Imported automatically from `vibe-common/styles/vibe-theme.css` (loaded via the `vibe-common` module dependency). Do not re-declare design tokens here.
- **Class conventions**: Use `.vibe-dialog-form` on dialog `<form>` roots, `.vibe-btn-primary` / `.vibe-btn-cancel` on action buttons, and `.form-group` + `<label>` for each field row.

### Common Gotchas
- **dnd5e v4+ activity model**: Foundry dnd5e 5.x uses `system.activities` as an Object Map (`{ id: activityData }`), NOT an array. Gemini outputs arrays (easier for the model), so `BlacksmithAgent.generate()` converts them before returning.
- **Item `_id` collisions**: Never trust AI-generated `_id` values. Always regenerate with `foundry.utils.randomID(16)`.
- **Adjustment replaces all items**: `adjustActor()` deletes all existing items and recreates them. This means any manually-added items on the actor will be lost after adjustment. This is intentional — the entire stat block is rebuilt from the adjusted blueprint.
- **Spellcasting feat filter**: `filteredCustomItems` excludes any custom item named "spellcasting" (case-insensitive) because `SpellcastingBuilder` handles that separately. If Blacksmith generates one anyway, it is silently dropped.
