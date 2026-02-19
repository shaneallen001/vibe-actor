/**
 * Gemini Pipeline
 * Orchestrates the multi-step AI actor generation process.
 */

import { ArchitectAgent } from "../agents/architect-agent.js";
import { QuartermasterAgent } from "../agents/quartermaster-agent.js";
import { BlacksmithAgent } from "../agents/blacksmith-agent.js";
import { AdjustmentAgent } from "../agents/adjustment-agent.js";
import { BlueprintFactory } from "../factories/blueprint-factory.js";
import * as CompendiumService from "./compendium-service.js";
import { SpellcastingBuilder } from "./spellcasting-builder.js";
import {
    sanitizeCustomItem,
    ensureActivityIds,
    ensureItemHasImage,
    validateAndRepairItemAutomation,
    normalizeMutuallyExclusiveOptionItems
} from "../utils/item-utils.js";
import { mapSkillsToKeys } from "../utils/actor-helpers.js";

export class GeminiPipeline {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async generateActor(request) {
        console.log("Vibe Actor | Starting Gemini Pipeline...");

        const blueprint = await this.runArchitect(request);
        console.log("Vibe Actor | Blueprint created:", blueprint);

        const selection = await this.runQuartermaster(blueprint);
        console.log("Vibe Actor | Components selected:", selection);

        const customItems = await this.runBlacksmith(blueprint, selection.customRequests);
        console.log("Vibe Actor | Custom items fabricated:", customItems);

        const actorData = await this.runBuilder(blueprint, selection.selectedUuids, customItems);
        console.log("Vibe Actor | Actor data assembled.");

        return actorData;
    }

    async adjustActor(actor, prompt) {
        console.log("Vibe Actor | Starting Actor Adjustment...");

        const currentBlueprint = await BlueprintFactory.createFromActor(actor);
        console.log("Vibe Actor | Current Blueprint extracted:", currentBlueprint);

        const blueprint = await this.runAdjustment(currentBlueprint, prompt);
        console.log("Vibe Actor | Adjusted Blueprint created:", blueprint);

        const selection = await this.runQuartermaster(blueprint);
        console.log("Vibe Actor | Components selected:", selection);

        const customItems = await this.runBlacksmith(blueprint, selection.customRequests);
        console.log("Vibe Actor | Custom items fabricated:", customItems);

        const actorData = await this.runBuilder(blueprint, selection.selectedUuids, customItems);

        console.log("Vibe Actor | Updating Actor document...");

        await actor.deleteEmbeddedDocuments("Item", actor.items.map(i => i.id));

        const tokenUpdate = { ...actorData.prototypeToken };
        delete tokenUpdate.texture;

        await actor.update({
            name: blueprint.name,
            system: actorData.system,
            prototypeToken: tokenUpdate
        });

        await actor.createEmbeddedDocuments("Item", actorData.items);

        console.log("Vibe Actor | Actor adjusted successfully.");
        return actor;
    }

    async runArchitect(request) {
        const agent = new ArchitectAgent(this.apiKey);
        return await agent.generate(request);
    }

    async runAdjustment(originalBlueprint, userPrompt) {
        const agent = new AdjustmentAgent(this.apiKey);
        const context = {
            originalBlueprint,
            userPrompt
        };
        return await agent.generate(context);
    }

    async runQuartermaster(blueprint) {
        const itemsToReview = [...(blueprint.features || [])];

        if (blueprint.equipment) {
            itemsToReview.push(...blueprint.equipment.map(e => ({
                name: e.name,
                type: e.type === "weapon" ? "weapon" : "equipment",
                description: e.description || e.name
            })));
        }

        const candidates = {};
        for (const item of itemsToReview) {
            let typeFilter;
            if (item.type === "spell") {
                typeFilter = ["spell"];
            } else if (item.type === "weapon") {
                typeFilter = ["weapon"];
            } else if (item.type === "equipment") {
                typeFilter = ["equipment"];
            } else {
                typeFilter = ["feat", "weapon"];
            }

            const results = await CompendiumService.search(item.name, typeFilter);
            candidates[item.name] = results.slice(0, 3).map(i => ({ name: i.name, uuid: i.uuid, type: i.type }));
        }

        const context = {
            blueprintFeatures: itemsToReview,
            candidates: candidates
        };

        const agent = new QuartermasterAgent(this.apiKey);
        return await agent.generate(context);
    }

    async runBlacksmith(blueprint, customRequests) {
        if (!customRequests || customRequests.length === 0) return [];

        const context = {
            creatureName: blueprint.name,
            cr: blueprint.cr,
            stats: blueprint.stats,
            requests: customRequests
        };

        const agent = new BlacksmithAgent(this.apiKey);
        return await agent.generate(context);
    }

    async runBuilder(blueprint, selectedUuids, customItems) {
        const compendiumItems = [];
        for (const uuid of selectedUuids) {
            const item = await fromUuid(uuid);
            if (item) {
                const itemData = item.toObject();
                delete itemData._id;
                compendiumItems.push(itemData);
            }
        }

        const processedCustomItems = await Promise.all(customItems.map(async item => {
            const sanitized = await sanitizeCustomItem(item);
            const { item: repaired, warnings } = validateAndRepairItemAutomation(sanitized);
            if (warnings.length > 0) {
                console.warn(`Vibe Actor | Automation repair warnings for "${repaired.name}":`, warnings);
            }
            const criticalWarnings = warnings.filter((warning) =>
                /activity\.save|damage\.onSave|template size|activity\.type|one-of choice|multiple effects|companion save rider|save rider/i.test(warning)
            );
            if (criticalWarnings.length > 0) {
                repaired.flags = repaired.flags || {};
                repaired.flags["vibe-actor"] = repaired.flags["vibe-actor"] || {};
                repaired.flags["vibe-actor"].criticalAutomationWarnings = criticalWarnings;
                console.warn(`Vibe Actor | Critical automation warnings for "${repaired.name}":`, criticalWarnings);
            }
            ensureActivityIds(repaired);
            await ensureItemHasImage(repaired);
            return repaired;
        }));

        const spellcastingResult = await SpellcastingBuilder.build(blueprint);
        const spellcastingFeat = spellcastingResult?.feat || null;
        const embeddedSpells = spellcastingResult?.embeddedSpells || [];

        const system = {
            abilities: blueprint.stats.abilities,
            attributes: {
                ac: { value: blueprint.stats.ac, calc: "natural" },
                hp: { value: blueprint.stats.hp, max: blueprint.stats.hp, formula: "" },
                movement: blueprint.stats.movement ? { ...blueprint.stats.movement, units: "ft" } : { walk: 30, units: "ft" },
                senses: {
                    darkvision: blueprint.senses?.darkvision || 0,
                    blindsight: blueprint.senses?.blindsight || 0,
                    tremorsense: blueprint.senses?.tremorsense || 0,
                    truesight: blueprint.senses?.truesight || 0,
                    units: "ft",
                    special: ""
                },
                spellcasting: blueprint.spellcasting?.ability || ""
            },
            details: {
                cr: blueprint.cr,
                type: { value: blueprint.type?.toLowerCase() || "humanoid" },
                alignment: blueprint.alignment || "Unaligned",
                biography: {
                    value: `
                        ${blueprint.biography || ""}
                        <hr>
                        <p><strong>Behavior:</strong> ${blueprint.behavior}</p>
                        <p><strong>Appearance:</strong> ${blueprint.appearance}</p>
                        <p><strong>Twist:</strong> ${blueprint.twist}</p>
                        <p><strong>Habitat:</strong> ${blueprint.habitat || "Unknown"}</p>
                        <p><strong>Treasure:</strong> ${blueprint.treasure || "None"}</p>
                    `
                },
                race: blueprint.name
            },
            traits: {
                size: blueprint.size || "med",
                languages: {
                    value: blueprint.languages || ["common"]
                },
                di: { value: blueprint.immunities || [] },
                dr: { value: blueprint.resistances || [] },
                ci: { value: blueprint.condition_immunities || [] }
            },
            skills: mapSkillsToKeys(blueprint.skills)
        };

        if (blueprint.stats.abilities) {
            for (const [key, val] of Object.entries(blueprint.stats.abilities)) {
                if (typeof val === 'number') {
                    system.abilities[key] = { value: val, proficient: 0 };
                } else {
                    system.abilities[key] = val;
                }
            }
        }

        if (blueprint.saves) {
            for (const ability of blueprint.saves) {
                if (system.abilities[ability]) {
                    system.abilities[ability].proficient = 1;
                }
            }
        }

        const normalizedCustomItems = normalizeMutuallyExclusiveOptionItems(processedCustomItems);
        const filteredCustomItems = normalizedCustomItems.filter(
            item => item.name?.toLowerCase() !== "spellcasting"
        );

        const allItems = [...compendiumItems, ...filteredCustomItems];
        if (spellcastingFeat) {
            allItems.push(spellcastingFeat);
            allItems.push(...embeddedSpells);
        }

        const actorData = {
            name: blueprint.name,
            type: "npc",
            img: "icons/svg/mystery-man.svg",
            system: system,
            items: this._applyDynamicDescriptions(allItems, blueprint.name),
            prototypeToken: {
                name: blueprint.name,
                displayName: 20,
                actorLink: false,
                disposition: -1,
                ...this._getTokenSizing(blueprint.size)
            }
        };

        return actorData;
    }

    _getTokenSizing(size) {
        const sizeMap = {
            "tiny": { width: 0.5, height: 0.5, scale: 0.5 },
            "sm": { width: 1, height: 1, scale: 0.8 },
            "med": { width: 1, height: 1, scale: 1 },
            "lg": { width: 2, height: 2, scale: 1 },
            "huge": { width: 3, height: 3, scale: 1 },
            "grg": { width: 4, height: 4, scale: 1 }
        };

        const s = sizeMap[size?.toLowerCase()] || sizeMap["med"];

        return {
            width: s.width,
            height: s.height,
            texture: {
                src: "icons/svg/mystery-man.svg",
                scaleX: s.scale,
                scaleY: s.scale
            }
        };
    }

    _applyDynamicDescriptions(items, actorName) {
        if (!actorName) return items;

        const escapedName = actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        const replacement = "[[lookup @name lowercase]]";

        return items.map(item => {
            const newItem = foundry.utils.duplicate(item);

            if (newItem.system?.description?.value) {
                newItem.system.description.value = newItem.system.description.value.replace(nameRegex, replacement);
            }

            if (newItem.system?.activities) {
                for (const activity of Object.values(newItem.system.activities)) {
                    if (activity.description?.value) {
                        activity.description.value = activity.description.value.replace(nameRegex, replacement);
                    }
                }
            }

            return newItem;
        });
    }
}
