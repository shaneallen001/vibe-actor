import { GenerativeAgent } from "./generative-agent.js";
import { MonsterActorSchema } from "../schemas/monster-actor-schema.js";

export class MonsterAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, MonsterActorSchema);
    }

    get schemaConstraint() { return false; }

    preprocessJson(json) {
        // Auto-merge { blueprint: {...}, items: [...] } pattern
        if (!json.name && json.blueprint && typeof json.blueprint === "object") {
            json = { ...json.blueprint, items: json.items || json.blueprint.items || [] };
        }
        // Auto-unwrap single-key wrapper ({ blueprint: { name, items, ... } })
        if (!json.name && !json.items && Object.keys(json).length === 1) {
            json = json[Object.keys(json)[0]];
        }
        // Fix items.system.description: ensure it's { value: string } not a plain string
        if (Array.isArray(json.items)) {
            json.items = json.items.map(item => {
                if (item.system?.description && typeof item.system.description === "string") {
                    item.system.description = { value: item.system.description };
                }
                if (item.system && !item.system.description) {
                    item.system.description = { value: "" };
                }
                return item;
            });
        }
        return json;
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

BLUEPRINT FIELD FORMATS (use exactly these shapes — wrong types cause validation failures):
- saves: array of ability strings → "saves": ["str", "dex"]
- skills: array of {name, value} objects → "skills": [{"name": "athletics", "value": 5}]
- senses: object with NUMBER values (no units) → "senses": {"darkvision": 60, "blindsight": 0, "tremorsense": 0, "truesight": 0}
- stats.movement: object with NUMBER values (no units) → "movement": {"walk": 30, "climb": 20, "fly": 0, "swim": 0, "burrow": 0}
- languages / resistances / immunities: arrays of strings → "languages": ["Common", "Thieves Cant"]

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
- Output a FLAT JSON object. Do NOT wrap fields in a "blueprint", "creature", "npc", or any other key. Start directly with { "name": "...", "cr": ..., "items": [...] }.
- system.description for items MUST be { "value": "string" } — an object with a "value" key, NOT a plain string.
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
