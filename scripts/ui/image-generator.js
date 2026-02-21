/**
 * OpenAI Image Generator
 * Handles generating images for actors using OpenAI's DALL-E 3
 */

import { generateAndSetActorImage, ensureDirectoryExists } from "../services/image-generation-service.js";
import { ImageGenerationDialog } from "./dialogs/image-generation-dialog.js";
import { getOpenAiApiKey } from "../../../vibe-common/scripts/settings.js";

export class ImageGenerator {
  static async generateImage(actor) {
    let apiKey;
    try {
      apiKey = getOpenAiApiKey();
    } catch (e) {
      return;
    }

    try {
      const { prompt, background } = await ImageGenerationDialog.prompt(actor.name);
      if (!prompt) return;

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
      await generateAndSetActorImage(actor, apiKey, {
        prompt,
        size: "1024x1024",
        background,
        partialImages: 3,
        saveDir,
        storageSrc,
        abortSignal: controller.signal
      });

      isDone = true;
      if (progressDialog.rendered) {
        progressDialog.close();
      }
      ui.notifications.info("Done! Actor image updated.");
    } catch (err) {
      if (err?.name === "AbortError") {
        ui.notifications.info("Image generation cancelled.");
      } else {
        console.error(err);
        const msg = err?.message || String(err);
        ui.notifications.error(`Image generation failed: ${msg}`);
      }
    }
  }
}
