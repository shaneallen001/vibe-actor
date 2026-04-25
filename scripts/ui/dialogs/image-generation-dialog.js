/**
 * Image Generation Dialog
 * Dialog for collecting user input for image generation
 */

import { getArtStylePresets } from "../../../../vibe-common/scripts/settings.js";

const { DialogV2 } = foundry.applications.api;

export class ImageGenerationDialog {
  static async prompt(defaultName) {
    const presets = getArtStylePresets();
    const showPresetSelect = presets.length > 1;
    const defaultStyle = presets[0]?.style ?? "";

    const presetSelectHtml = showPresetSelect ? `
      <div>
        <label>Art Style Preset</label>
        <select name="stylePreset">
          ${presets.map((p, i) => `<option value="${i}">${_escapeHtml(p.name)}</option>`).join("")}
        </select>
      </div>
    ` : "";

    const content = `
      <div style="display:grid; gap:0.5rem;">
        <div>
          <label>Subject (short)</label>
          <input name="subject" type="text" value="${_escapeHtml(defaultName || "")}" placeholder="e.g., Elf ranger">
        </div>
        ${presetSelectHtml}
        <div>
          <label>Description (details, style, mood)</label>
          <textarea name="desc" rows="5" placeholder="Pose, gear, lighting, background, art style...">${_escapeHtml(defaultStyle)}</textarea>
        </div>
        <label style="display:flex; gap:.5rem; align-items:center;">
          <input type="checkbox" name="transparent" checked/>
          Transparent background
        </label>
        <p style="margin:.25rem 0 0; font-size:12px; opacity:.8">
          Streaming is on; image will update 1-3 times before the final.
        </p>
      </div>
    `;

    return new Promise((resolve) => {
      const dialog = new (class extends DialogV2 {
        _onRender(context, options) {
          super._onRender(context, options);
          if (!showPresetSelect) return;
          const selectEl = this.element.querySelector('[name="stylePreset"]');
          const descEl = this.element.querySelector('[name="desc"]');
          if (selectEl && descEl) {
            selectEl.addEventListener("change", (ev) => {
              const idx = parseInt(ev.currentTarget.value, 10);
              descEl.value = presets[idx]?.style ?? "";
            });
          }
        }
      })({
        window: { title: "Generate Actor Image" },
        content,
        buttons: [
          {
            action: "ok",
            label: "Generate",
            icon: "fas fa-wand-magic-sparkles",
            default: true,
            callback: (event, button) => {
              const form = button.form;
              const subject = form.querySelector('[name="subject"]')?.value?.trim();
              const desc = form.querySelector('[name="desc"]')?.value?.trim();
              const finalPrompt = (subject || desc) ? [subject, desc].filter(Boolean).join(". ") : "";
              const wantTransparent = form.querySelector('[name="transparent"]')?.checked;
              resolve({ prompt: finalPrompt, background: wantTransparent ? "transparent" : "auto" });
            }
          },
          {
            action: "cancel",
            label: "Cancel",
            callback: () => resolve({})
          }
        ],
        close: () => resolve({})
      });
      dialog.render(true);
    });
  }
}

function _escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
