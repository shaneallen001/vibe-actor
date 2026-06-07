import { GenerativeAgent } from "./generative-agent.js";
import { GeminiItemListSchema } from "../schemas/foundry-item-schema.js";

export class ArtificerAgent extends GenerativeAgent {
    constructor(apiKey) {
        super(apiKey, GeminiItemListSchema);
    }

    get systemPrompt() {
        return `You are the "Artificer".
    
    Task: Generate valid Foundry VTT Item Data for requested custom magical equipment, weapons, and armor.
    
    Output a JSON ARRAY of Item objects.
    
    CRITICAL RULES:
    - Target Foundry VTT v13 with dnd5e 5.1.8 activity model conventions.
    - Set item "type" to "weapon", "equipment", "consumable", or "loot" as appropriate.
    - Give items evocative names, unique descriptions, and flavor text. 
    - Include "system.identified": true, and "system.unidentified.description" with a vague description of the item's appearance.
    - Ensure "_id"s are unique 16-char strings.
    - Populate "system.rarity" (e.g., "uncommon", "rare", "veryRare", "legendary", "artifact").
    - Populate "system.price" (e.g., { value: 500, denomination: "gp" }).
    - If it requires attunement, set "system.attunement" to "required".
    - Populate "system.properties" for important tags (e.g., "mgc" for magical, "fin" for finesse, "hvy" for heavy, "amm" for ammunition, "stealthDisadvantage").
    - DO NOT generate root-level "system.activation", use activities.
    
    EQUIPMENT SPECIFICS:
    - For weapons: 
      - define "system.type.value" (e.g., "martialM", "simpleR").
      - define "system.type.baseItem" if applicable (e.g., "longsword", "shortbow").
      - define "system.damage.parts" array (e.g., [{number: 1, denomination: 8, types: ["slashing"]}]).
      - if it deals extra magical damage, add it to system.damage.parts.
      - don't forget "system.range" for ranged/thrown weapons (value and long).
    - For armor:
      - define "system.type.value" (e.g., "light", "medium", "heavy", "shield").
      - define "system.type.baseItem" (e.g., "leather", "plate", "shield").
      - define "system.armor.value" (the base AC).
      - define "system.armor.magicalBonus" if it's +1, +2, etc.
      
    MAGICAL EFFECTS:
    - If the item has activated magical abilities (like a staff casting a spell or a sword shooting a beam), use "system.activities" to build those mechanics just like a feature or spell.
    - Activities MUST include a description with "chatFlavor" that describes the visual effect in combat.
    - Put any charges or uses in "system.uses", and set up activity consumption to spend those uses (targets: [{type: "itemUses", value: "1"}]).
    - Activities requiring saving throws MUST have "type": "save", define "save.ability" (["dex"]), "save.dc.calculation": "spellcasting" (or flat), and "damage.onSave" (e.g., "half" or "none").
    - Activities requiring attack rolls MUST have "type": "attack", and define "attack.flat": false.
    - For passive bonuses (e.g. AC +1, Resistance to Fire), and conditions applied to others, you MUST create Active Effects in the root "effects" array.
      - Each effect must have {"name": string, "type": "base", "description": string, "changes": [{"key": string, "mode": 2, "value": string}]}.
      - Example change keys: "system.attributes.ac.bonus" (AC), "system.traits.dr.value" (Damage Resistance).
    `;
    }

    async generate(context, options = {}) {
        const items = await super.generate(context, options);

        return items.map(item => {
            item._id = foundry.utils.randomID(16);

            if (item.system?.activities && Array.isArray(item.system.activities)) {
                const activityMap = {};
                item.system.activities.forEach(activity => {
                    activity._id = foundry.utils.randomID(16);
                    activityMap[activity._id] = activity;
                });
                item.system.activities = activityMap;
            }
            return item;
        });
    }
}
