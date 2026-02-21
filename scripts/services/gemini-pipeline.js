/**
 * Gemini Pipeline
 * Orchestrates the multi-step AI actor generation process.
 */

import { ArchitectAgent } from "../agents/architect-agent.js";
import { QuartermasterAgent } from "../agents/quartermaster-agent.js";
import { BlacksmithAgent } from "../agents/blacksmith-agent.js";
import { ArtificerAgent } from "../agents/artificer-agent.js";
import { AdjustmentAgent } from "../agents/adjustment-agent.js";
import { BlueprintFactory } from "../factories/blueprint-factory.js";
import * as CompendiumService from "./compendium-service.js";
import { SpellcastingBuilder } from "./spellcasting-builder.js";
import { generateAndSaveItemImage } from "./image-generation-service.js";
import { getOpenAiApiKey, getGeminiApiKey, getImageGenerationModel } from "../../../vibe-common/scripts/settings.js";
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

    async generateActor(request, options = {}) {
        const onProgress = options.onProgress || (() => { });
        console.log("Vibe Actor | Starting Gemini Pipeline...");

        onProgress("Architecting blueprint...", 10);
        const blueprint = await this.runArchitect(request, options);
        console.log("Vibe Actor | Blueprint created:", blueprint);

        onProgress("Selecting equipment and features...", 30);
        const selection = await this.runQuartermaster(blueprint, options);
        console.log("Vibe Actor | Components selected:", selection);

        onProgress("Fabricating custom items...", 60);

        const featureRequests = selection.customRequests ? selection.customRequests.filter(r => r.type === "feat" || r.type === "spell" || r.type === "action" || r.type === "reaction" || r.type === "bonus" || !["weapon", "armor", "shield", "gear", "equipment"].includes(r.type)) : [];
        const equipmentRequests = selection.customRequests ? selection.customRequests.filter(r => ["weapon", "armor", "shield", "gear", "equipment"].includes(r.type)) : [];

        const customFeatures = await this.runBlacksmith(blueprint, featureRequests, options);
        const customEquipment = await this.runArtificer(blueprint, equipmentRequests, options);
        let customItems = [...customFeatures, ...customEquipment];

        if (options.generateItemImages) {
            onProgress("Painting icons for custom items...", 75);
            customItems = await this._processGeneratedItems(customItems, {
                generateImage: true,
                createItem: false,
                abortSignal: options.abortSignal
            });
        }

        console.log("Vibe Actor | Custom items fabricated:", customItems);

        onProgress("Assembling actor data...", 90);
        const actorData = await this.runBuilder(blueprint, selection.selectedUuids, customItems);
        console.log("Vibe Actor | Actor data assembled.");

        onProgress("Complete!", 100);
        return actorData;
    }

    async adjustActor(actor, prompt, options = {}) {
        const onProgress = options.onProgress || (() => { });
        console.log("Vibe Actor | Starting Actor Adjustment...");

        onProgress("Extracting current character blueprint...", 10);
        const currentBlueprint = await BlueprintFactory.createFromActor(actor);
        console.log("Vibe Actor | Current Blueprint extracted:", currentBlueprint);

        onProgress("Designing adjustments...", 20);
        const blueprint = await this.runAdjustment(currentBlueprint, prompt, options);
        console.log("Vibe Actor | Adjusted Blueprint created:", blueprint);

        onProgress("Selecting updated equipment and features...", 40);
        const selection = await this.runQuartermaster(blueprint, options);
        console.log("Vibe Actor | Components selected:", selection);

        onProgress("Fabricating new custom items...", 60);

        const featureRequests = selection.customRequests ? selection.customRequests.filter(r => r.type === "feat" || r.type === "spell" || r.type === "action" || r.type === "reaction" || r.type === "bonus" || !["weapon", "armor", "shield", "gear", "equipment"].includes(r.type)) : [];
        const equipmentRequests = selection.customRequests ? selection.customRequests.filter(r => ["weapon", "armor", "shield", "gear", "equipment"].includes(r.type)) : [];

        const customFeatures = await this.runBlacksmith(blueprint, featureRequests, options);
        const customEquipment = await this.runArtificer(blueprint, equipmentRequests, options);
        let customItems = [...customFeatures, ...customEquipment];

        if (options.generateItemImages) {
            onProgress("Painting icons for custom items...", 75);
            customItems = await this._processGeneratedItems(customItems, {
                generateImage: true,
                createItem: false,
                abortSignal: options.abortSignal
            });
        }

        console.log("Vibe Actor | Custom items fabricated:", customItems);


        onProgress("Reassembling actor data...", 90);
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

        onProgress("Complete!", 100);
        console.log("Vibe Actor | Actor adjusted successfully.");
        return actor;
    }

    async runArchitect(request, options = {}) {
        const agent = new ArchitectAgent(this.apiKey);
        return await agent.generate(request, options);
    }

    async runAdjustment(originalBlueprint, userPrompt, options = {}) {
        const agent = new AdjustmentAgent(this.apiKey);
        const context = {
            originalBlueprint,
            userPrompt
        };
        return await agent.generate(context, options);
    }

    async runQuartermaster(blueprint, options = {}) {
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
        return await agent.generate(context, options);
    }

    async runBlacksmith(blueprint, customRequests, options = {}) {
        if (!customRequests || customRequests.length === 0) return [];

        customRequests.forEach(request => {
            if (globalThis.ui?.notifications) {
                globalThis.ui.notifications.info(`Vibe Actor | Designing custom feature: ${request.name}...`);
            }
        });

        const context = {
            creatureName: blueprint.name,
            cr: blueprint.cr,
            stats: blueprint.stats,
            requests: customRequests
        };

        const agent = new BlacksmithAgent(this.apiKey);
        return await agent.generate(context, options);
    }

    async runArtificer(blueprint, customRequests, options = {}) {
        if (!customRequests || customRequests.length === 0) return [];

        customRequests.forEach(request => {
            if (globalThis.ui?.notifications) {
                globalThis.ui.notifications.info(`Vibe Actor | Forging custom equipment: ${request.name}...`);
            }
        });

        const context = {
            creatureName: blueprint?.name || "Unknown",
            cr: blueprint?.cr || 0,
            requests: customRequests
        };

        const agent = new ArtificerAgent(this.apiKey);
        return await agent.generate(context, options);
    }

    async generateCustomFeatures(requests, context = {}, options = {}) {
        requests.forEach(request => {
            if (globalThis.ui?.notifications) {
                globalThis.ui.notifications.info(`Vibe Actor | Designing custom feature: ${request.name || 'Unknown Feature'}...`);
            }
        });
        const agent = new BlacksmithAgent(this.apiKey);
        const items = await agent.generate({ ...context, requests }, options);
        return await this._processGeneratedItems(items, options);
    }

    async generateCustomEquipment(requests, context = {}, options = {}) {
        requests.forEach(request => {
            if (globalThis.ui?.notifications) {
                globalThis.ui.notifications.info(`Vibe Actor | Forging custom equipment: ${request.name || 'Unknown Equipment'}...`);
            }
        });
        const agent = new ArtificerAgent(this.apiKey);
        const items = await agent.generate({ ...context, requests }, options);
        return await this._processGeneratedItems(items, options);
    }

    async _processGeneratedItems(items, options) {
        const processed = await Promise.all(items.map(async item => {
            const sanitized = await sanitizeCustomItem(item);
            const { item: repaired, warnings } = validateAndRepairItemAutomation(sanitized);

            if (options.generateImage) {
                const model = getImageGenerationModel();
                let imageApiKey;
                try {
                    imageApiKey = model === "imagen-3" ? getGeminiApiKey() : getOpenAiApiKey();
                } catch (e) {
                    console.warn("Vibe Actor | Could not get image generation API key");
                }

                if (imageApiKey) {
                    try {
                        const styleDesc = repaired.system?.description?.value ? repaired.system.description.value.replace(/<[^>]*>?/gm, " ").substring(0, 150) : '';
                        const prompt = `Fantasy roleplaying game icon art, white background, single object centered. Subject: ${repaired.name}. ${styleDesc}`;
                        const saveDir = `worlds/${game.world.id}/ai-images/items`;
                        const imgPath = await generateAndSaveItemImage(repaired.name, imageApiKey, model, {
                            prompt,
                            size: "1024x1024",
                            saveDir,
                            storageSrc: "data",
                            abortSignal: options.abortSignal
                        });
                        repaired.img = imgPath;
                    } catch (e) {
                        console.error("Vibe Actor | Item image generation failed:", e);
                    }
                }
            }

            await ensureItemHasImage(repaired);
            ensureActivityIds(repaired);

            if (options.createItem) {
                return await Item.create(repaired);
            }
            return repaired;
        }));
        return processed;
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
                console.warn(`Vibe Actor | Automation repair warnings for "${repaired.name}": `, warnings);
            }
            const criticalWarnings = warnings.filter((warning) =>
                /activity\.save|damage\.onSave|template size|activity\.type|one-of choice|multiple effects|companion save rider|save rider/i.test(warning)
            );
            if (criticalWarnings.length > 0) {
                repaired.flags = repaired.flags || {};
                repaired.flags["vibe-actor"] = repaired.flags["vibe-actor"] || {};
                repaired.flags["vibe-actor"].criticalAutomationWarnings = criticalWarnings;
                console.warn(`Vibe Actor | Critical automation warnings for "${repaired.name}": `, criticalWarnings);
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

        const escapedName = actorName.replace(/[.*+?^${ }()|[\]\\]/g, '\\$&');
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
