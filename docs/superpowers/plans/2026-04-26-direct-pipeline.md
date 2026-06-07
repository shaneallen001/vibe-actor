# Direct Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "Direct Pipeline" that replaces the 4-step Architect→Quartermaster→Blacksmith→Artificer chain with a single MonsterAgent call, producing a complete actor in ~1 API round-trip instead of 4+.

**Architecture:** A new `MonsterAgent` receives the user prompt and outputs a combined JSON containing all BlueprintSchema fields plus a `items` array of Foundry-ready item JSON. `GeminiPipeline.generateActorDirect()` calls it, applies the same post-processing validators, feeds the result into the existing `runBuilder()` and `SpellcastingBuilder`, and creates the actor. The old pipeline remains intact. A Foundry setting + a dialog toggle opt-in to the new flow.

**Tech Stack:** Foundry VTT v14, dnd5e 5.1.x, Google Gemini API (`callGemini` from vibe-common), Zod schemas, existing `validateAndRepairItemAutomation` / `sanitizeCustomItem` / `SpellcastingBuilder` utilities.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `scripts/schemas/monster-actor-schema.js` | Combined Zod schema: BlueprintSchema + items array |
| Create | `scripts/agents/monster-agent.js` | Single-agent with merged system prompt; ID + activity-map normalization |
| Modify | `scripts/services/gemini-pipeline.js` | Add `generateActorDirect()` method |
| Modify | `scripts/settings.js` | Register `useDirectPipeline` Boolean setting |
| Modify | `templates/vibe-actor-dialog.html` | Add "Direct Pipeline" toggle |
| Modify | `scripts/ui/dialogs/vibe-actor-dialog.js` | Read setting, pass flag through to pipeline |

---

## Task 1: MonsterActorSchema

**Files:**
- Create: `vibe-actor/scripts/schemas/monster-actor-schema.js`

This schema extends `BlueprintSchema` by appending an `items` array. Spells are intentionally excluded from `items` — the `spellcasting` field from BlueprintSchema is kept so `SpellcastingBuilder` can still do its compendium lookup. Features, weapons, equipment, and all custom abilities go in `items`.

- [ ] **Step 1: Create the schema file**

```javascript
// vibe-actor/scripts/schemas/monster-actor-schema.js
import { BlueprintSchema } from "./blueprint-schema.js";
import { GeminiItemListSchema } from "./foundry-item-schema.js";

export const MonsterActorSchema = BlueprintSchema.extend({
    items: GeminiItemListSchema.describe(
        "All custom features, weapons, equipment, and abilities as complete Foundry-ready item JSON. " +
        "Do NOT include spells here — list spell names in the spellcasting field instead."
    ),
});
```

- [ ] **Step 2: Verify schema imports compile (no bundler — check in-game console later)**

  This step is verified during Task 3's manual test. Nothing to run standalone.

---

## Task 2: MonsterAgent

**Files:**
- Create: `vibe-actor/scripts/agents/monster-agent.js`

The system prompt merges the Architect, Blacksmith, and Artificer system prompts into a coherent whole. The `generate()` override assigns random IDs and converts the `items[].system.activities` array output from Gemini into the `{id: data}` map that Foundry requires (same pattern as Blacksmith/Artificer).

- [ ] **Step 1: Create the agent file**

```javascript
// vibe-actor/scripts/agents/monster-agent.js
import { GenerativeAgent } from "./generative-agent.js";
import { MonsterActorSchema } from "../schemas/monster-actor-schema.js";

export class MonsterAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, MonsterActorSchema);
    }

    get systemPrompt() {
        return `You are an expert D&D 5e monster designer and Foundry VTT item builder.
Your task is to design a complete D&D 5e NPC/monster AND generate all of its Foundry VTT item data in a single JSON output.

═══════════════════════════════════════════════════
PART 1 — CREATURE DESIGN
═══════════════════════════════════════════════════

Design a unique D&D 5e NPC based on the user's request. Populate all blueprint fields (name, cr, type, alignment, stats, senses, languages, resistances, immunities, features list, spellcasting, behavior, appearance, twist, biography, etc.).

STATS & BALANCE:
- Validate abilities against standard 5e limits (1–30).
- Ensure HP and AC match the CR per the D&D 5e Monster Manual guidelines.
- Provide rich, evocative descriptions in behavior, appearance, twist, and biography.

FEATURES LIST (blueprint.features):
- This is a DESCRIPTION-ONLY list used to inform item generation. Do not rely on it for mechanics — full mechanics go in the items array.
- For each feature include automation hints (resolution, save, condition, splitActivities, rider) when mechanics are explicit in the description.

SPELLCASTING (blueprint.spellcasting):
- Only include if the creature is a spellcaster.
- Ability: "int" (wizards/liches), "wis" (clerics/druids), "cha" (sorcerers/warlocks/bards).
- Use ONLY core SRD spell names exactly (e.g. "Fireball", "Lightning Bolt", "Animate Dead"). Do NOT use non-SRD spells (Booming Blade, Absorb Elements, Toll the Dead, etc.) — they will not be found in the compendium.
- atWill: cantrips and unlimited-use spells.
- perDay: limited spells with appropriate daily limits (powerful 7th–9th: 1/day; mid 4th–6th: 1–2/day; lower 1st–3rd: 2–3/day).
- Do NOT put spell items in the items array — spells are handled via the spellcasting field.

═══════════════════════════════════════════════════
PART 2 — FOUNDRY ITEM GENERATION
═══════════════════════════════════════════════════

Generate all features, weapons, equipment, and abilities as complete Foundry VTT item JSON in the "items" array.
Do NOT generate spell items — list spells in the spellcasting field above.

TARGET: Foundry VTT v13 + dnd5e 5.1.8 activity model.

ITEM TYPE RULES:
- Monster abilities, special attacks, reactions, legendary actions → type "feat", system.type.value "monster"
- Weapons → type "weapon"
- Armor/shields → type "equipment"

CRITICAL RULES:
- "_id" must be a unique non-empty string (use any 16-char alphanumeric placeholder; it will be replaced).
- Do NOT generate root-level "system.activation" — all activation goes inside the activity.
- "system.activities" MUST be an array of activity objects (will be converted to a map automatically).
- Each activity MUST have a non-empty "_id" string.
- Keep item "type" accurate — use "feat" for monster abilities unless it is physically a weapon/armor.
- Activities MUST include a "description" object with a "chat" string describing the combat flavor.

AUTOMATION MAPPING RULES:
- If prose says a target makes a save → activity.type "save", include save.ability + save.dc.
- If prose has "attack roll to hit" AND "target makes a save" (save-gated rider) → two activities:
    1) attack activity for hit/damage
    2) separate save rider activity (utility/manual-trigger) for the conditional save
  Do NOT leave the save branch only in prose text.
- If a save controls damage → set damage.onSave ("half" or "none").
- If prose specifies an area template (cone/line/sphere/cylinder/cube) → include target.template.type AND target.template.size.
- If prose applies a condition (charmed, poisoned, etc.) → create item-level effects in root "effects" array:
    { "_id": "<unique-id>", "name": "Poisoned", "type": "base", "statuses": ["poisoned"], "description": "" }
  and reference them in activity.effects via _id.
- If prose includes duration/range/target → encode in activity.duration, activity.range, activity.target.
- If prose includes limited uses ("1/day", "3/day") → encode activity.uses and activity.consumption.targets.
- If prose is a trigger ("when hit", "start of turn") → model as utility/manual-trigger, not a normal action.
- Never output activity.type "damage" when the primary mechanic is a saving throw — put damage inside the "save" activity using damage.onSave.
- If a feature offers multiple mutually exclusive options → use a parent utility selector activity + one child save activity per option.

WEAPON SPECIFICS:
- system.type.value (e.g. "martialM", "simpleR")
- system.type.baseItem if applicable (e.g. "longsword", "shortbow")
- system.damage.parts array (e.g. [{number:1, denomination:8, types:["slashing"]}])
- system.range for ranged/thrown weapons

ARMOR SPECIFICS:
- system.type.value ("light", "medium", "heavy", "shield")
- system.type.baseItem (e.g. "leather", "plate", "shield")
- system.armor.value (base AC number)
- system.armor.magicalBonus if +1/+2/etc.

MAGICAL EQUIPMENT:
- Activated abilities → system.activities just like features.
- Charges → system.uses + activity consumption targets: [{type:"itemUses", value:"1"}].
- Passive bonuses (AC+1, resistance) → Active Effects in root "effects" array with changes array.
  Example change keys: "system.attributes.ac.bonus", "system.traits.dr.value".
- system.rarity: "common","uncommon","rare","veryRare","legendary","artifact"
- system.price: { value: number, denomination: "gp" }
- system.identified: true; system.unidentified.description with vague appearance text.
- If attunement required: system.attunement "required".
- system.properties for tags: "mgc", "fin", "hvy", "amm", etc.

REQUIRED PATTERN EXAMPLES:
- "60-foot cone, DC 16 Dex save, fail: 4d6 acid + blinded, success: half damage":
    activity.type="save", target.template={type:"cone",size:"60",units:"ft"},
    save={ability:["dex"],dc:{calculation:"flat",formula:"16"}}, damage.onSave="half",
    effects=[{_id:"...",name:"Blinded",statuses:["blinded"]}], activity.effects=[{_id:"...",onSave:false}]
- "Ranged Attack, hit + DC 14 Con save or poisoned":
    Activity 1: type="attack" for hit/damage
    Activity 2: type="utility" trigger="on-hit", save={ability:["con"],dc:{...}}, linked poisoned effect
`;
    }

    async generate(context, options = {}) {
        const result = await super.generate(context, options);

        // Assign real Foundry IDs and convert activities array → map (same as Blacksmith/Artificer)
        result.items = (result.items || []).map(item => {
            item._id = foundry.utils.randomID(16);

            if (item.system?.activities && Array.isArray(item.system.activities)) {
                const activityMap = {};
                item.system.activities.forEach(activity => {
                    activity._id = foundry.utils.randomID(16);
                    activityMap[activity._id] = activity;
                });
                item.system.activities = activityMap;
            }

            if (item.effects) {
                item.effects = item.effects.map(effect => ({
                    ...effect,
                    _id: effect._id || foundry.utils.randomID(16),
                }));
            }

            return item;
        });

        return result;
    }
}
```

---

## Task 3: `GeminiPipeline.generateActorDirect()`

**Files:**
- Modify: `vibe-actor/scripts/services/gemini-pipeline.js`

Add the import for `MonsterAgent` and a new `generateActorDirect()` method. This method:
1. Calls `MonsterAgent.generate()` for the combined blueprint+items in one shot
2. Splits the result: blueprint fields go to `runBuilder()`, items go through the same `_processGeneratedItems()` as the old pipeline
3. SpellcastingBuilder still runs on `blueprint.spellcasting` — spells from compendium, same quality as before

- [ ] **Step 1: Add the import at the top of `gemini-pipeline.js`**

After the existing imports (around line 10), add:

```javascript
import { MonsterAgent } from "../agents/monster-agent.js";
```

- [ ] **Step 2: Add `generateActorDirect()` method inside the `GeminiPipeline` class**

Add this method after `generateActor()` (around line 68):

```javascript
async generateActorDirect(request, options = {}) {
    const onProgress = options.onProgress || (() => { });
    console.log("Vibe Actor | Starting Direct Pipeline (single-agent)...");

    onProgress("Generating monster...", 15);
    const agent = new MonsterAgent(this.apiKey);
    const result = await agent.generate(request, { abortSignal: options.abortSignal });
    console.log("Vibe Actor | Direct agent result:", result);

    // Separate blueprint fields from items
    const { items: rawItems, ...blueprint } = result;

    onProgress("Processing items...", 65);
    let customItems = await this._processGeneratedItems(rawItems || [], {
        generateImage: options.generateItemImages,
        createItem: false,
        abortSignal: options.abortSignal
    });

    onProgress("Assembling actor...", 88);
    const actorData = await this.runBuilder(blueprint, [], customItems);
    console.log("Vibe Actor | Direct pipeline complete.");

    onProgress("Complete!", 100);
    return actorData;
}
```

- [ ] **Step 3: Verify the method is inside the class**

Open `gemini-pipeline.js` and confirm `generateActorDirect` sits between other methods inside `class GeminiPipeline { ... }` before the closing brace.

---

## Task 4: Setting Registration

**Files:**
- Modify: `vibe-actor/scripts/settings.js`

Add a single Boolean setting `useDirectPipeline` that defaults to `false`. This keeps the old pipeline as the stable default.

- [ ] **Step 1: Add the setting inside `registerActorModuleSettings()`**

```javascript
game.settings.register(ACTOR_NAMESPACE, "useDirectPipeline", {
    name: "Use Direct Pipeline (Experimental)",
    hint: "Generate the entire monster in a single AI call instead of the multi-step pipeline. Faster but experimental. Uses the same Gemini API key.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
});
```

Add a helper export at the bottom of the file:

```javascript
export function getUseDirectPipeline() {
    return game.settings.get(ACTOR_NAMESPACE, "useDirectPipeline");
}
```

---

## Task 5: Dialog Template Toggle

**Files:**
- Modify: `vibe-actor/templates/vibe-actor-dialog.html`

Add a visually distinct toggle below the existing "Generate icons" toggle, inside a labeled section so users know it's experimental.

- [ ] **Step 1: Add the toggle before the footer `<div>`**

Replace the closing `</div>` of the `generate-item-image-row` div and the `vibe-dialog-footer` block with:

```html
    <div class="generate-item-image-row"
        style="margin-top: 8px; border-top: 1px solid var(--vibe-border-light); padding-top: 8px;">
        {{> "modules/vibe-common/templates/components/vibe-toggle.hbs" name="generateItemImages" checked=false
        labelText="Generate icons for unique equipment/features? (Slower)"}}
    </div>

    <div class="vibe-pipeline-row"
        style="margin-top: 8px; border-top: 1px solid var(--vibe-border-light); padding-top: 8px;">
        {{> "modules/vibe-common/templates/components/vibe-toggle.hbs" name="useDirectPipeline" checked=useDirectPipeline
        labelText="Direct Pipeline — single AI call (Experimental)"}}
    </div>

    <div class="vibe-dialog-footer">
        <button type="submit" class="vibe-btn vibe-btn-primary">
            <i class="fas fa-hat-wizard"></i> Generate Actor
        </button>
    </div>
```

> Note: `useDirectPipeline` is pre-seeded from the setting so the toggle reflects the user's saved preference.

---

## Task 6: Wire the Dialog

**Files:**
- Modify: `vibe-actor/scripts/ui/dialogs/vibe-actor-dialog.js`

Three changes:
1. Import `getUseDirectPipeline` from settings
2. Pass it to the template context in `_prepareContext()`
3. Read the toggle in `_onGenerate()` and pass `useDirect` to `generateActor()`
4. In `generateActor()`: accept `useDirect` param, call `pipeline.generateActorDirect()` when true and update progress label

- [ ] **Step 1: Update the import at the top of the file**

Change:
```javascript
import { getGeminiApiKey, getArtStylePresets } from "../../../../vibe-common/scripts/settings.js";
```
To:
```javascript
import { getGeminiApiKey, getArtStylePresets } from "../../../../vibe-common/scripts/settings.js";
import { getUseDirectPipeline } from "../../settings.js";
```

- [ ] **Step 2: Add `useDirectPipeline` to `_prepareContext()`**

In the return object of `_prepareContext()`, add the field:

```javascript
async _prepareContext(options) {
    this.#stylePresets = getArtStylePresets();
    return {
        crOptions: [ ... ],           // unchanged
        typeOptions: [ ... ],         // unchanged
        sizeOptions: [ ... ],         // unchanged
        stylePresets: this.#stylePresets,
        showStylePreset: this.#stylePresets.length > 1,
        firstPresetStyle: this.#stylePresets[0]?.style ?? "",
        useDirectPipeline: getUseDirectPipeline(),   // ← add this
    };
}
```

- [ ] **Step 3: Read `useDirectPipeline` from form data in `_onGenerate()`**

In `static async _onGenerate(event, form, formData)`, update the call to `generateActor`:

```javascript
await VibeActorDialog.generateActor(
    data.cr, data.type, data.size, prompt,
    Boolean(data.generateImage), imageOptions,
    Boolean(data.generateItemImages),
    Boolean(data.useDirectPipeline)    // ← add this argument
);
```

- [ ] **Step 4: Accept and route `useDirect` in `generateActor()`**

Update the static method signature and the pipeline call:

```javascript
static async generateActor(cr, type, size, prompt, generateImage, imageOptions, generateItemImages = false, useDirect = false) {
    let apiKey;
    try { apiKey = getGeminiApiKey(); } catch (e) { return; }

    // ... (AbortController + progressDialog setup unchanged) ...

    try {
        // ... (permission check unchanged) ...

        const pipeline = new GeminiPipeline(apiKey);

        const pipelineCall = useDirect
            ? pipeline.generateActorDirect(
                { cr, type, size, prompt },
                { abortSignal: controller.signal, generateItemImages, onProgress: updateProgress }
              )
            : pipeline.generateActor(
                { cr, type, size, prompt },
                { abortSignal: controller.signal, generateItemImages, onProgress: updateProgress }
              );

        const generationTasks = [pipelineCall];

        // ... (image generation push + Promise.all unchanged) ...
```

---

## Task 7: Manual Smoke Test

No automated test runner exists in this project. Test by opening Foundry and generating an actor.

- [ ] **Step 1: Reload the Foundry module**

In the Foundry VTT game, open the console (F12) and run:
```javascript
window.location.reload();
```

- [ ] **Step 2: Verify the setting appears**

Open **Game Settings → Configure Settings → Module Settings → Vibe Actor**. Confirm "Use Direct Pipeline (Experimental)" toggle is visible and defaults to `false`.

- [ ] **Step 3: Verify the dialog toggle appears**

Open the Vibe Actor dialog (click the wand icon in the sidebar or actor directory). Confirm "Direct Pipeline — single AI call (Experimental)" toggle appears at the bottom.

- [ ] **Step 4: Test OLD pipeline still works**

With the toggle OFF, generate a simple actor (e.g. "Goblin warrior"). Confirm it creates successfully and opens the actor sheet.

- [ ] **Step 5: Test DIRECT pipeline**

Enable the toggle in the dialog. Generate an actor (e.g. "Vampire noble with ice magic, CR 10"). Confirm:
- Progress dialog shows "Generating monster..." then "Processing items..." then "Assembling actor..."
- Actor is created with correct name, stats, items
- Items have non-empty `_id` fields
- Items with save mechanics have `system.activities` populated as a map (not array)
- Check browser console for any `Vibe Actor |` error messages

- [ ] **Step 6: Test with a spellcaster**

Generate "Ancient blue dragon" (CR 23, has Frightful Presence, Wing Attack, Lightning Breath). With Direct Pipeline ON, confirm:
- `blueprint.spellcasting` is absent (dragon has no spells) OR present and resolved correctly if you try a wizard-type
- Breath weapon appears as an item with a save activity

- [ ] **Step 7: Test with "Generate icons" enabled**

Enable both toggles (Direct Pipeline + Generate icons). Confirm item images are generated without errors.

---

## Self-Review

**Spec coverage:**
- ✅ Single MonsterAgent replaces 4-step chain → Task 2/3
- ✅ Optional opt-in (default off) → Task 4/5/6
- ✅ Same post-processing validators applied → Task 3 uses `_processGeneratedItems()`
- ✅ SpellcastingBuilder still runs for spell quality → Task 3 passes blueprint to `runBuilder()`
- ✅ Image generation unchanged → Task 6 doesn't touch image path
- ✅ Old pipeline preserved intact → Task 3 adds new method, doesn't modify old one
- ✅ Progress reporting for new flow → Task 3 has `onProgress` calls

**Placeholder scan:** No TBD/TODO/placeholder text in code blocks.

**Type consistency:**
- `MonsterActorSchema` exports from `monster-actor-schema.js` and is imported in `monster-agent.js` ✅
- `MonsterAgent` imported in `gemini-pipeline.js` ✅
- `getUseDirectPipeline()` exported from `settings.js` and imported in `vibe-actor-dialog.js` ✅
- `generateActorDirect()` signature matches call in dialog ✅
- `useDirect` parameter added to `generateActor()` and threaded through ✅
