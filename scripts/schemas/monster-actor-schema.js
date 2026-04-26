// vibe-actor/scripts/schemas/monster-actor-schema.js
import { BlueprintSchema } from "./blueprint-schema.js";
import { GeminiItemListSchema } from "./foundry-item-schema.js";

export const MonsterActorSchema = BlueprintSchema.extend({
    items: GeminiItemListSchema.describe(
        "All custom features, weapons, equipment, and abilities as complete Foundry-ready item JSON. " +
        "Do NOT include spells here — list spell names in the spellcasting field instead."
    ),
});
