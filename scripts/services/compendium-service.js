/**
 * Compendium Service
 * Handles looking up items in system compendiums
 */

import { autoEquipIfArmor, ensureItemHasImage, ensureActivityIds, sanitizeCustomItem, ensureItemHasId } from "../utils/item-utils.js";

const COMPENDIUM_MAP = {
    "dnd5e.spells": ["spell"],
    "dnd5e.items": ["weapon", "equipment", "consumable", "tool", "loot", "backpack", "feat"],
    "dnd5e.monsterfeatures": ["feat"],
    "dnd5e.classfeatures": ["feat"]
};

let _indexCache = null;

export async function initializeIndex() {
    if (_indexCache) return _indexCache;
    _indexCache = [];

    console.log("Vibe Actor | Initializing Compendium Index...");

    for (const [packId, allowedTypes] of Object.entries(COMPENDIUM_MAP)) {
        const pack = game.packs.get(packId);
        if (!pack) {
            console.warn(`Vibe Actor | Compendium pack not found: ${packId}`);
            continue;
        }

        const index = await pack.getIndex({ fields: ["name", "type", "img"] });

        for (const entry of index) {
            if (allowedTypes.includes(entry.type)) {
                _indexCache.push({
                    uuid: entry.uuid,
                    name: entry.name,
                    type: entry.type,
                    img: entry.img,
                    pack: packId,
                    _id: entry._id
                });
            }
        }
    }

    console.log(`Vibe Actor | Indexed ${_indexCache.length} compendium items.`);
    return _indexCache;
}

export async function search(query, types = []) {
    if (!_indexCache) await initializeIndex();
    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();

    const exactMatches = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase() === lowerQuery;
    });

    if (exactMatches.length > 0) return exactMatches;

    const startsWith = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase().startsWith(lowerQuery);
    });

    if (startsWith.length > 0) return startsWith;

    const includes = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return item.name.toLowerCase().includes(lowerQuery);
    });

    if (includes.length > 0) return includes;

    const reverseIncludes = _indexCache.filter(item => {
        if (types.length && !types.includes(item.type)) return false;
        return lowerQuery.includes(item.name.toLowerCase());
    });

    if (reverseIncludes.length > 0) {
        return reverseIncludes.sort((a, b) => b.name.length - a.name.length);
    }

    return [];
}

export async function getAll(type) {
    if (!_indexCache) await initializeIndex();
    return _indexCache.filter(item => item.type === type);
}

export async function getSpellUuid(spellName) {
    if (!spellName) return null;
    const matches = await search(spellName, ["spell"]);
    return matches.length > 0 ? matches[0].uuid : null;
}

export async function getItemData(indexEntry) {
    if (!indexEntry || !indexEntry.pack || !indexEntry._id) return null;
    const pack = game.packs.get(indexEntry.pack);
    if (!pack) return null;
    const doc = await pack.getDocument(indexEntry._id);
    return doc ? doc.toObject() : null;
}

export async function buildCompendiumBackedItems(aiItems = []) {
    const resolvedItems = [];
    let multiattackText = "";
    let spellcastingText = "";
    let reusedCount = 0;
    let customCount = 0;

    await initializeIndex();

    for (const rawItem of aiItems) {
        if (!rawItem || typeof rawItem !== "object") continue;
        const name = rawItem.name?.trim();
        if (!name) continue;

        const lowerName = name.toLowerCase();
        const description = foundry.utils.getProperty(rawItem, "system.description.value") ?? "";

        if (lowerName.includes("multiattack")) {
            if (!multiattackText) {
                multiattackText = description || name;
            }
            continue;
        }

        if (lowerName.includes("spellcasting")) {
            if (!spellcastingText) {
                spellcastingText = description || name;
            }
            continue;
        }

        const matches = await search(name, [rawItem.type]);
        const bestMatch = matches.length > 0 ? matches[0] : null;

        if (bestMatch) {
            const compendiumItem = await getItemData(bestMatch);
            if (compendiumItem) {
                autoEquipIfArmor(compendiumItem);
                await ensureItemHasImage(compendiumItem);
                ensureActivityIds(compendiumItem);
                resolvedItems.push(compendiumItem);
                reusedCount++;
                continue;
            }
        }

        const customItem = await sanitizeCustomItem(rawItem);
        autoEquipIfArmor(customItem);
        ensureActivityIds(customItem);
        resolvedItems.push(customItem);
        customCount++;
    }

    console.log(`Vibe Actor | Compendium item prep reused ${reusedCount} entries, created ${customCount} custom items.`);
    return { resolvedItems, multiattackText, spellcastingText, reusedCount, customCount };
}

export async function findCompendiumEntry(itemData) {
    const matches = await search(itemData.name, [itemData.type]);
    if (matches.length > 0) {
        return getItemData(matches[0]);
    }
    return null;
}
