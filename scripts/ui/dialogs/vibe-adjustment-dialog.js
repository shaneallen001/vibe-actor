import { VibeToast } from "../../../../vibe-common/scripts/ui/toast-manager.js";
/**
 * Vibe Adjustment Dialog
 * Dialog for adjusting an existing actor using AI
 */
import { GeminiPipeline } from "../../services/gemini-pipeline.js";
import { getGeminiApiKey } from "../../../../vibe-common/scripts/settings.js";

export class VibeAdjustmentDialog extends Application {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "vibe-adjustment-dialog",
            title: "Vibe Adjust",
            template: "modules/vibe-actor/templates/vibe-adjustment-dialog.html",
            width: 400,
            height: "auto",
            classes: ["vibe-combat-window"],
            resizable: false
        });
    }

    getData() {
        return {
            actor: this.actor,
            name: this.actor.name
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Cancel button
        html.find(".cancel-button").click((ev) => {
            ev.preventDefault();
            if (this._abortController) {
                this._abortController.abort();
            }
            this.close();
        });

        // Adjust button
        html.find(".adjust-button").click(this._onAdjust.bind(this));

        // Enter key support in textarea
        html.find("textarea").keydown((ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
                ev.preventDefault();
                this._onAdjust(ev);
            }
        });
    }

    async _onAdjust(event) {
        event.preventDefault();
        const button = this.element.find(".adjust-button");
        const originalText = button.html();

        // Get prompt
        const prompt = this.element.find("textarea[name='prompt']").val();
        if (!prompt || !prompt.trim()) {
            VibeToast.warn("Please enter an adjustment request.");
            return;
        }

        try {
            // Set loading state
            button.prop("disabled", true);
            button.html('<i class="fas fa-spinner fa-spin"></i> Adjusting...');

            this._abortController = new AbortController();

            // Execute pipeline
            let apiKey;
            try {
                apiKey = getGeminiApiKey();
            } catch (e) {
                return;
            }
            this.pipeline = new GeminiPipeline(apiKey);
            // The pipeline's adjustActor method now handles the actor update internally
            await this.pipeline.adjustActor(this.actor, prompt, {
                abortSignal: this._abortController.signal,
                onProgress: (msg) => {
                    if (this.element.find(".adjust-button").length) {
                        button.html(`<i class="fas fa-spinner fa-spin"></i> ${msg}`);
                    }
                }
            });

            VibeToast.info(`Adjusted ${this.actor.name} successfully!`);
            this.close();

        } catch (error) {
            if (error.name === "AbortError") {
                VibeToast.info("Adjustment cancelled.");
            } else {
                console.error("Vibe Actor | Adjustment Error:", error);
                if (error.message.includes("Invalid JSON") || error.message.includes("Return unexpected") || error.message.includes("parse") || error.message.includes("Max retries") || error.message.includes("Gemini request failed")) {
                    VibeToast.error(`The AI returned unexpected data. Click 'Adjust' to retry. (${error.message})`);
                } else {
                    VibeToast.error(`Adjustment failed: ${error.message}`);
                }
            }
        } finally {
            this._abortController = null;
            // Reset button state
            if (this.element.find(".adjust-button").length) {
                button.prop("disabled", false);
                button.html(originalText);
            }
        }
    }
}
