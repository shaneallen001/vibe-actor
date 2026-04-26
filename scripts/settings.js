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

  game.settings.register(ACTOR_NAMESPACE, "useDirectPipeline", {
    name: "Use Direct Pipeline (Experimental)",
    hint: "Generate the entire monster in a single AI call instead of the multi-step pipeline. Faster but experimental. Uses the same Gemini API key.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });
}

export function getUseDirectPipeline() {
  return game.settings.get(ACTOR_NAMESPACE, "useDirectPipeline");
}
