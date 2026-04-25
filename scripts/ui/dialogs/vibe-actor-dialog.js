import { VibeToast } from "../../../../vibe-common/scripts/ui/toast-manager.js";
import { getCrOptions, CREATURE_TYPES, SIZE_OPTIONS } from "../../constants.js";
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { ImageGenerator } from "../image-generator.js";
import { getGeminiApiKey, getArtStylePresets } from "../../../../vibe-common/scripts/settings.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class VibeActorDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "vibe-actor-dialog",
    classes: ["vibe-theme"],
    tag: "form",
    window: { title: "Vibe Actor - Generate Creature", resizable: false },
    form: { handler: VibeActorDialog._onGenerate, closeOnSubmit: true }
  };

  static PARTS = {
    main: { template: "modules/vibe-actor/templates/vibe-actor-dialog.html" }
  };

  #abort = null;
  #stylePresets = [];
  #apiKey = null;

  static async show() {
    let apiKey;
    try { apiKey = getGeminiApiKey(); } catch (e) { return; }
    const instance = new VibeActorDialog();
    instance.#apiKey = apiKey;
    await instance.render({ force: true });
  }

  async _prepareContext(options) {
    this.#stylePresets = getArtStylePresets();
    return {
      crOptions: [
        { value: "", label: "Any" },
        ...getCrOptions().map(cr => ({ value: cr, label: cr, selected: cr === "1" }))
      ],
      typeOptions: [
        { value: "", label: "Any" },
        ...CREATURE_TYPES.map(t => ({ value: t, label: t, selected: t === "Humanoid" }))
      ],
      sizeOptions: [
        { value: "", label: "Any" },
        ...SIZE_OPTIONS.map(s => ({ value: s, label: s, selected: s === "Medium" }))
      ],
      stylePresets: this.#stylePresets,
      showStylePreset: this.#stylePresets.length > 1,
      firstPresetStyle: this.#stylePresets[0]?.style ?? ""
    };
  }

  _onRender(context, options) {
    this.#abort?.abort();
    const { signal } = (this.#abort = new AbortController());

    // Art style preset → imageDesc textarea
    this.element.querySelector('[name="imageStylePreset"]')
      ?.addEventListener("change", (ev) => {
        const idx = parseInt(ev.currentTarget.value, 10);
        const style = this.#stylePresets[idx]?.style ?? "";
        this.element.querySelector('[name="imageDesc"]').value = style;
      }, { signal });

    // Toggle image generation inputs
    const toggle = this.element.querySelector('[name="generateImage"]');
    const inputs = this.element.querySelector("#image-gen-inputs");
    const updateVisibility = () => {
      inputs.style.display = toggle.checked ? "" : "none";
    };
    toggle.addEventListener("change", updateVisibility, { signal });
    updateVisibility();

    // Auto-writer (lore generation) button
    this.element.querySelector(".btn-generate-lore")
      ?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const btn = ev.currentTarget;
        const icon = btn.querySelector("i");
        const textarea = this.element.querySelector("#prompt");
        const currentPrompt = textarea.value.trim();

        if (!currentPrompt) {
          ui.notifications?.warn("Please enter a basic concept first.");
          return;
        }

        btn.disabled = true;
        icon.className = "fas fa-spinner fa-spin";
        textarea.value = "";

        try {
          const { callGeminiStream } = await import("../../../../vibe-common/scripts/services/gemini-service.js");
          const apiKey = game.settings.get("vibe-common", "geminiApiKey");
          if (!apiKey) throw new Error("API Key missing.");
          const prompt = `Flesh out this basic character concept into a detailed, evocative 1-paragraph fantasy lore description suitable for a tabletop RPG monster or NPC. Keep it strictly to the lore. Do not output stats or markdown formatting.\nConcept: ${currentPrompt}`;
          await callGeminiStream({
            apiKey,
            prompt,
            onChunk: (chunk, fullText) => {
              textarea.value = fullText.trimStart();
            }
          });
        } catch (e) {
          console.error(e);
          ui.notifications?.error("Lore generation failed.");
          textarea.value = currentPrompt;
        } finally {
          btn.disabled = false;
          icon.className = "fas fa-magic";
        }
      }, { signal });
  }

  static async _onGenerate(event, form, formData) {
    const data = formData.object;
    const prompt = (data.prompt || "").trim();
    if (!prompt) {
      VibeToast.warn("Please provide a description/prompt for the creature.");
      return false; // prevent close
    }

    let imageOptions = null;
    if (data.generateImage) {
      const subject = (data.imageSubject || "").trim();
      const desc = (data.imageDesc || "").trim();
      imageOptions = {
        prompt: [subject, desc].filter(Boolean).join(". ") || prompt,
        background: data.transparentBg ? "transparent" : "auto"
      };
    }

    await VibeActorDialog.generateActor(
      data.cr, data.type, data.size, prompt,
      Boolean(data.generateImage), imageOptions, Boolean(data.generateItemImages)
    );
  }

  static async generateActor(cr, type, size, prompt, generateImage, imageOptions, generateItemImages = false) {
    let apiKey;
    try { apiKey = getGeminiApiKey(); } catch (e) { return; }

    const controller = new AbortController();
    let isDone = false;

    // Progress dialog — simple DialogV2 with a cancel button
    const progressEl = document.createElement("div");
    progressEl.style.cssText = "padding:10px;text-align:center;";
    progressEl.innerHTML = `<p id="vibe-actor-progress-msg" style="font-style:italic;">Initializing pipeline...</p>`;

    const progressDialog = new DialogV2({
      window: { title: "Generating Actor..." },
      classes: ["vibe-theme"],
      content: progressEl.outerHTML,
      buttons: [{
        action: "cancel",
        label: "Cancel",
        icon: "fas fa-times",
        callback: () => controller.abort()
      }]
    });
    progressDialog.render({ force: true });

    const updateProgress = (msg) => {
      progressDialog.element?.querySelector("#vibe-actor-progress-msg")?.textContent !== undefined
        && (progressDialog.element.querySelector("#vibe-actor-progress-msg").textContent = msg);
    };

    try {
      if (!game.user.can("ACTOR_CREATE")) {
        throw new Error("You do not have permission to create actors.");
      }

      if (generateImage && imageOptions && !imageOptions.prompt) {
        imageOptions.prompt = prompt;
      }

      const pipeline = new GeminiPipeline(apiKey);
      const generationTasks = [
        pipeline.generateActor(
          { cr, type, size, prompt },
          { abortSignal: controller.signal, generateItemImages, onProgress: updateProgress }
        )
      ];

      let generatedImageBlobPath = null;
      if (generateImage) {
        generationTasks.push((async () => {
          const imgService = await import("../../services/image-generation-service.js");
          const settingsMod = await import("../../../vibe-common/scripts/settings.js");
          const { generateAndSetActorImage, generateAndSetGeminiActorImage } = imgService;
          const { getOpenAiApiKey, getGeminiApiKey: getGKey, getImageGenerationModel } = settingsMod;
          const model = getImageGenerationModel();
          let imageApiKey;
          try {
            imageApiKey = model.includes("imagen") ? getGKey() : getOpenAiApiKey();
          } catch (e) { return null; }

          const genOptions = {
            prompt: imageOptions.prompt,
            size: "1024x1024",
            background: imageOptions.background,
            saveDir: `worlds/${game.world.id}/ai-images`,
            storageSrc: "data",
            abortSignal: controller.signal
          };
          const dummyActor = {
            name: imageOptions.prompt.substring(0, 20),
            update: async (data) => { generatedImageBlobPath = data.img; },
            isToken: false,
            getActiveTokens: () => []
          };
          if (model.includes("imagen")) {
            await generateAndSetGeminiActorImage(dummyActor, imageApiKey, model, genOptions);
          } else {
            await generateAndSetActorImage(dummyActor, imageApiKey, genOptions);
          }
        })());
      }

      const [actorData] = await Promise.all(generationTasks);
      if (!actorData?.name) throw new Error("Generated actor data is missing required fields.");

      if (generatedImageBlobPath) {
        actorData.img = generatedImageBlobPath;
        actorData.prototypeToken ??= {};
        actorData.prototypeToken.texture ??= {};
        actorData.prototypeToken.texture.src = generatedImageBlobPath;
      }

      const actor = await Actor.create(actorData, { renderSheet: true });
      if (!actor) throw new Error("Failed to create actor document.");
      VibeToast.info(`Successfully created actor: ${actor.name}`);

    } catch (error) {
      if (error.name === "AbortError") {
        VibeToast.info("Actor generation cancelled.");
      } else {
        console.error("Vibe Actor | Error generating actor:", error);
        const isRetryable = ["Invalid JSON","Return unexpected","parse","Max retries","Gemini request failed"]
          .some(s => error.message.includes(s));

        if (isRetryable) {
          const retry = await DialogV2.confirm({
            window: { title: "Generation Error" },
            content: `<p>The AI returned unexpected data.</p><p style="color:grey;font-size:0.9em;">${error.message}</p>`,
            yes: { label: "Retry", icon: "fas fa-redo" },
            no:  { label: "Cancel" }
          });
          if (retry) {
            VibeActorDialog.generateActor(cr, type, size, prompt, generateImage, imageOptions, generateItemImages);
            return;
          }
        } else {
          VibeToast.error(`Failed to generate actor: ${error.message}`);
        }
      }
    } finally {
      isDone = true;
      if (progressDialog.rendered) progressDialog.close();
    }
  }
}
