/**
 * OpenAI Image Generator
 * Handles generating images for actors using OpenAI's DALL-E 3
 */

import { generateAndSetActorImage, ensureDirectoryExists } from "../services/image-generation-service.js";
import { ImageGenerationDialog } from "./dialogs/image-generation-dialog.js";

export class ImageGenerator {
  static async generateImage(actor) {
    const apiKey = game.settings.get("vibe-actor", "openaiApiKey");
    if (!apiKey) {
      ui.notifications.error("Please set the OpenAI API Key in the Vibe Actor module settings.");
      return;
    }

    try {
      const { prompt, background } = await ImageGenerationDialog.prompt(actor.name);
      if (!prompt) return;

      ui.notifications.info(`Generating image for ${actor.name} (streaming)...`);

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
        storageSrc
      });

      ui.notifications.info("Done! Actor image updated.");
    } catch (err) {
      console.error(err);
      const msg = (err?.name === "AbortError")
        ? "Request timed out."
        : (err?.message || String(err));
      ui.notifications.error(`Image generation failed: ${msg}`);
    }
  }
}
