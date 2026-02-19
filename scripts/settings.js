/**
 * Vibe Actor settings registration and migration.
 */

const ACTOR_NAMESPACE = "vibe-actor";
const LEGACY_NAMESPACE = "vibe-combat";
const MIGRATION_KEY = "migratedFromVibeCombat";

export function registerActorModuleSettings() {
  game.settings.register(ACTOR_NAMESPACE, "geminiApiKey", {
    name: "Gemini API Key",
    hint: "Your Google Gemini API key for generating and adjusting actors.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });

  game.settings.register(ACTOR_NAMESPACE, "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Your OpenAI API key for generating actor images.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });

  game.settings.register(ACTOR_NAMESPACE, "allowPlayerActorGeneration", {
    name: "Allow Players to Generate Actors",
    hint: "If enabled, players can use Vibe Actor features with configured API keys. Players still need Foundry permission to create actors.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register(ACTOR_NAMESPACE, MIGRATION_KEY, {
    name: "Vibe Actor Migration Complete",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  migrateLegacyActorSettings().catch((error) => {
    console.warn("Vibe Actor: Failed to migrate legacy settings", error);
  });
}

async function migrateLegacyActorSettings() {
  const migrated = game.settings.get(ACTOR_NAMESPACE, MIGRATION_KEY);
  if (migrated) return;

  const migrateMap = [
    "geminiApiKey",
    "openaiApiKey",
    "allowPlayerActorGeneration"
  ];

  for (const key of migrateMap) {
    const currentValue = game.settings.get(ACTOR_NAMESPACE, key);
    const legacySettingId = `${LEGACY_NAMESPACE}.${key}`;
    if (!game.settings.settings?.has?.(legacySettingId)) {
      continue;
    }
    const legacyValue = game.settings.get(LEGACY_NAMESPACE, key);

    if (isEmptySetting(currentValue) && !isEmptySetting(legacyValue)) {
      await game.settings.set(ACTOR_NAMESPACE, key, legacyValue);
    }
  }

  await game.settings.set(ACTOR_NAMESPACE, MIGRATION_KEY, true);
}

function isEmptySetting(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return false;
}
