/**
 * Vibe Actor Module
 * Main entry point for actor generation and adjustment features.
 */

import { registerActorModuleSettings } from "./settings.js";
import { addVibeActorButton } from "./ui/actor-button-injector.js";
import { VibeActorDialog } from "./ui/dialogs/vibe-actor-dialog.js";
import { ImageGenerator } from "./ui/image-generator.js";
import { VibeAdjustmentDialog } from "./ui/dialogs/vibe-adjustment-dialog.js";
import { GeminiPipeline } from "./services/gemini-pipeline.js";

Hooks.once("init", () => {
  // Expose the API immediately during init so other modules can safely check for it during ready
  const module = game.modules.get("vibe-actor");
  if (module) {
    module.api = {
      GeminiPipeline,
      VibeActorDialog
    };
  }
});

Hooks.once("ready", () => {
  if (game.system.id !== "dnd5e") {
    console.warn("Vibe Actor: This module requires the dnd5e system.");
    return;
  }

  registerActorModuleSettings();
});

// The original "Vibe Actor" sidebar button has been removed in favor of the unified Vibe Menu in vibe-common.

Hooks.on("getHeaderControlsApplicationV2", (app, controls) => {
  if (!game.user.isGM) return;

  if (app instanceof foundry.applications.sheets.ActorSheetV2) {
    const actor = app.document;
    if (!actor) return;

    controls.push({
      icon: "fas fa-magic",
      label: "Vibe Image",
      action: "vibeImage",
      onClick: async () => {
        try {
          await ImageGenerator.generateImage(actor);
        } catch (error) {
          console.error("Vibe Actor | Error in Vibe Image handler:", error);
        }
      }
    });

    controls.push({
      icon: "fas fa-wrench",
      label: "Vibe Adjust",
      action: "vibeAdjustActor",
      onClick: () => {
        new VibeAdjustmentDialog(actor).render(true);
      }
    });
  }
});
