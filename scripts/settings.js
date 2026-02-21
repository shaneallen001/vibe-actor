/**
 * Vibe Actor settings registration and migration.
 */

const ACTOR_NAMESPACE = "vibe-actor";

export function registerActorModuleSettings() {
  game.settings.register(ACTOR_NAMESPACE, "allowPlayerActorGeneration", {
    name: "Allow Players to Generate Actors",
    hint: "If enabled, players can use Vibe Actor features with configured API keys. Players still need Foundry permission to create actors.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}
