/**
 * Image Generation Dialog
 * Dialog for collecting user input for image generation
 */

import { getArtStylePresets } from "../../../../vibe-common/scripts/settings.js";

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
          <input name="subject" type="text" value="${defaultName || ""}" placeholder="e.g., Elf ranger">
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
      new Dialog({
        title: "Generate Actor Image",
        content,
        buttons: {
          ok: {
            label: "Generate",
            icon: '<i class="fas fa-wand-magic-sparkles"></i>',
            callback: (html) => {
              const subject = html.find('[name="subject"]').val()?.trim();
              const desc = html.find('[name="desc"]').val()?.trim();
              const finalPrompt = (subject || desc) ? [subject, desc].filter(Boolean).join(". ") : "";
              const wantTransparent = html.find('[name="transparent"]')[0]?.checked;
              resolve({ prompt: finalPrompt, background: wantTransparent ? "transparent" : "auto" });
            }
          },
          cancel: { label: "Cancel", callback: () => resolve({}) }
        },
        default: "ok",
        render: (html) => {
          if (!showPresetSelect) return;
          html.find('[name="stylePreset"]').on("change", (ev) => {
            const idx = parseInt(ev.currentTarget.value, 10);
            const style = presets[idx]?.style ?? "";
            html.find('[name="desc"]').val(style);
          });
        },
        close: () => resolve({})
      }).render(true);
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
