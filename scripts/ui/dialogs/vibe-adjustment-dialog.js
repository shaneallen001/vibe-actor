import { VibeToast } from "../../../../vibe-common/scripts/ui/toast-manager.js";
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { getGeminiApiKey } from "../../../../vibe-common/scripts/settings.js";
import { VibeApplicationV2 } from "../../../../vibe-common/scripts/ui/vibe-application.js";

export class VibeAdjustmentDialog extends VibeApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "vibe-adjustment-dialog",
    classes: ["vibe-combat-window", "vibe-theme"],
    tag: "form",
    window: { title: "Vibe Adjust", resizable: false },
    form: { handler: VibeAdjustmentDialog._onAdjust, closeOnSubmit: false }
  };

  static PARTS = {
    main: { template: "modules/vibe-actor/templates/vibe-adjustment-dialog.html" }
  };

  #abort = null;
  #actor = null;
  #abortController = null;

  constructor(actor, options = {}) {
    super(options);
    this.#actor = actor;
  }

  async _prepareContext(options) {
    return { actor: this.#actor, name: this.#actor.name };
  }

  _onRender(context, options) {
    this.#abort?.abort();
    const { signal } = (this.#abort = new AbortController());

    this.element.querySelector(".cancel-button")
      ?.addEventListener("click", (ev) => {
        ev.preventDefault();
        this.#abortController?.abort();
        this.close();
      }, { signal });

    this.element.querySelector("textarea")
      ?.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
          ev.preventDefault();
          this.element.requestSubmit();
        }
      }, { signal });
  }

  static async _onAdjust(event, form, formData) {
    // `this` is the VibeAdjustmentDialog instance when called as a form handler
    const prompt = formData.object.prompt;
    if (!prompt?.trim()) {
      VibeToast.warn("Please enter an adjustment request.");
      return;
    }

    const button = form.querySelector(".adjust-button");
    const originalHTML = button.innerHTML;

    try {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adjusting...';

      this.#abortController = new AbortController();
      let apiKey;
      try { apiKey = getGeminiApiKey(); } catch (e) { return; }

      this.pipeline = new GeminiPipeline(apiKey);
      await this.pipeline.adjustActor(this.#actor, prompt, {
        abortSignal: this.#abortController.signal,
        onProgress: (msg) => {
          if (button.isConnected) button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${msg}`;
        }
      });

      VibeToast.info(`Adjusted ${this.#actor.name} successfully!`);
      this.close();

    } catch (error) {
      if (error.name === "AbortError") {
        VibeToast.info("Adjustment cancelled.");
      } else {
        console.error("Vibe Actor | Adjustment Error:", error);
        const isRetryable = ["Invalid JSON","Return unexpected","parse","Max retries","Gemini request failed"]
          .some(s => error.message.includes(s));
        if (isRetryable) {
          VibeToast.error(`The AI returned unexpected data. Click 'Adjust' to retry. (${error.message})`);
        } else {
          VibeToast.error(`Adjustment failed: ${error.message}`);
        }
      }
    } finally {
      this.#abortController = null;
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = originalHTML;
      }
    }
  }
}
