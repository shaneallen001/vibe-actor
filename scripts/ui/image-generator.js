import { VibeToast } from "../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * OpenAI Image Generator
 * Handles generating images for actors using OpenAI's DALL-E 3
 */

import { generateAndSetActorImage, generateAndSetGeminiActorImage, ensureDirectoryExists } from "../services/image-generation-service.js";
import { ImageGenerationDialog } from "./dialogs/image-generation-dialog.js";
import { getOpenAiApiKey, getGeminiApiKey, getImageGenerationModel } from "../../../vibe-common/scripts/settings.js";

export class ImageGenerator {
  static async generateImage(actor, options = null) {
    const model = getImageGenerationModel();
    let apiKey;
    try {
      if (model === "imagen-3") {
        apiKey = getGeminiApiKey();
      } else {
        apiKey = getOpenAiApiKey();
      }
    } catch (e) {
      return;
    }

    try {
      let prompt, background;

      if (options && options.prompt) {
        // Skip dialog if options were passed in direct from Vibe Actor Dialog
        prompt = options.prompt;
        background = options.background || "auto";
      } else {
        // Fallback to dialog if called from sheet directly
        const result = await ImageGenerationDialog.prompt(actor.name);
        if (!result.prompt) return;
        prompt = result.prompt;
        background = result.background;
      }

      const controller = new AbortController();
      let isDone = false;

      const progressDialog = new Dialog({
        title: "Generating Image...",
        content: `<div style="padding: 10px; text-align: center;"><p id="vibe-actor-img-msg" style="font-style: italic;">Requesting image for ${actor.name}...</p></div>`,
        buttons: {
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => {
              controller.abort();
            }
          }
        },
        close: () => {
          if (!isDone) controller.abort();
        }
      }, { width: 300 });

      progressDialog.render(true);

      const saveDir = `worlds/${game.world.id}/ai-images`;
      const storageSrc = "data";

      // Ensure destination dir exists
      await ensureDirectoryExists(storageSrc, saveDir);

      // Stream from Images API
      const genOptions = {
        prompt,
        size: "1024x1024",
        background,
        saveDir,
        storageSrc,
        abortSignal: controller.signal
      };

      if (model === "imagen-3") {
        await generateAndSetGeminiActorImage(actor, apiKey, genOptions);
      } else {
        await generateAndSetActorImage(actor, apiKey, genOptions);
      }

      isDone = true;
      if (progressDialog.rendered) {
        progressDialog.close();
      }
      VibeToast.info("Done! Actor image updated.");
    } catch (err) {
      if (err?.name === "AbortError") {
        VibeToast.info("Image generation cancelled.");
      } else {
        console.error(err);
        const msg = err?.message || String(err);
        VibeToast.error(`Image generation failed: ${msg}`);
      }
    }
  }
}
