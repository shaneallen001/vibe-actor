/**
 * Vibe Actor Dialog
 * Dialog and Gemini API integration for generating actors
 */

import { getCrOptions, CREATURE_TYPES, SIZE_OPTIONS } from "../../constants.js";
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { ensureItemHasId, ensureActivityIds } from "../../factories/actor-factory.js";
import { ImageGenerator } from "../image-generator.js";
import { getGeminiApiKey } from "../../../../vibe-common/scripts/settings.js";

export class VibeActorDialog {
  static async show() {
    let apiKey;
    try {
      apiKey = getGeminiApiKey();
    } catch (e) {
      return;
    }

    // Generate context for template
    const context = {
      crOptions: getCrOptions(),
      typeOptions: CREATURE_TYPES,
      sizeOptions: SIZE_OPTIONS
    };

    const content = await renderTemplate("modules/vibe-actor/templates/vibe-actor-dialog.html", context);

    new Dialog({
      title: "Vibe Actor - Generate Creature",
      content: content,
      buttons: {
        generate: {
          icon: '<i class="fas fa-magic"></i>',
          label: "Generate",
          callback: async (html) => {
            const cr = html.find('[name="cr"]').val();
            const type = html.find('[name="type"]').val();
            const size = html.find('[name="size"]').val();
            const prompt = html.find('[name="prompt"]').val();

            const generateImage = html.find('[name="generateImage"]').is(":checked");

            if (!prompt || prompt.trim() === "") {
              ui.notifications.warn("Please provide a description/prompt for the creature.");
              return;
            }

            // Note: generateActor is static, so we call VibeActorDialog.generateActor
            // (or this.generateActor if 'this' is bound to the class, which it is in a static method)
            await this.generateActor(cr, type, size, prompt, generateImage);
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel"
        }
      },
      default: "generate"
    }).render(true);
  }

  static async generateActor(cr, type, size, prompt, generateImage) {
    let apiKey;
    try {
      apiKey = getGeminiApiKey();
    } catch (e) {
      return;
    }

    const controller = new AbortController();
    let isDone = false;

    // Show progress dialog instead of notification
    const progressDialog = new Dialog({
      title: "Generating Actor...",
      content: `<div style="padding: 10px; text-align: center;"><p id="vibe-actor-progress-msg" style="font-style: italic;">Initializing pipeline...</p></div>`,
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
        if (!isDone) {
          controller.abort();
        }
      }
    }, { width: 300 });

    progressDialog.render(true);

    try {
      // Check permissions first
      if (!game.user.can("ACTOR_CREATE")) {
        throw new Error("You do not have permission to create actors. Please ask your GM to grant 'Create New Actors' permission.");
      }

      const pipeline = new GeminiPipeline(apiKey);
      const actorData = await pipeline.generateActor(
        { cr, type, size, prompt },
        {
          abortSignal: controller.signal,
          onProgress: (msg) => {
            if (progressDialog.element) {
              progressDialog.element.find("#vibe-actor-progress-msg").text(msg);
            }
          }
        }
      );

      // Ensure the actor has the correct structure for dnd5e
      if (!actorData.name) {
        throw new Error("Generated actor data is missing required fields.");
      }

      // Create the actor
      const actor = await Actor.create(actorData, { renderSheet: true });
      if (!actor) {
        throw new Error("Failed to create actor document.");
      }

      ui.notifications.info(`Successfully created actor: ${actor.name}`);

      if (generateImage) {
        await ImageGenerator.generateImage(actor);
      }

    } catch (error) {
      if (error.name === "AbortError") {
        ui.notifications.info("Actor generation cancelled.");
      } else {
        console.error("Vibe Actor | Error generating actor:", error);

        // Show a retry dialog for JSON/generation errors
        if (error.message.includes("Invalid JSON") || error.message.includes("Return unexpected") || error.message.includes("parse") || error.message.includes("Max retries") || error.message.includes("Gemini request failed")) {
          new Dialog({
            title: "Generation Error",
            content: `<div style="padding: 10px; text-align: center;"><p>The AI returned unexpected data.</p><p style="color: grey; font-size: 0.9em;">${error.message}</p></div>`,
            buttons: {
              retry: {
                icon: '<i class="fas fa-redo"></i>',
                label: "Click to Retry",
                callback: () => {
                  this.generateActor(cr, type, size, prompt, generateImage);
                }
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
              }
            },
            default: "retry"
          }).render(true);
        } else {
          ui.notifications.error(`Failed to generate actor: ${error.message}`);
        }
      }
    } finally {
      isDone = true;
      if (progressDialog.rendered) {
        progressDialog.close();
      }
    }
  }
}
