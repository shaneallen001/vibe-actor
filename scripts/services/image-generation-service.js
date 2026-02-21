/**
 * Image Generation Service
 * Handles generating images for actors using OpenAI's DALL-E 3 (or compatible API)
 */

export async function generateImageOpenAI(apiKey, { prompt, size, abortSignal }) {
    const OPENAI_MODEL = "dall-e-3";

    const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            prompt,
            size,
            n: 1,
            response_format: "b64_json"
        }),
        signal: abortSignal
    });

    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(`OpenAI error ${resp.status}: ${data?.error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    const item = data?.data?.[0];
    const b64 = item?.b64_json;
    const url = item?.url;

    if (b64) {
        return { blob: b64ToBlob(b64, "image/png"), mime: "image/png" };
    } else if (url) {
        const blob = await (await fetch(url)).blob();
        return { blob, mime: "image/png" };
    } else {
        throw new Error("No image data returned from OpenAI");
    }
}

export async function generateImageGemini(apiKey, { prompt, size, abortSignal }) {
    const GEMINI_MODEL = "imagen-3.0-generate-002";

    // Size mapping for Imagen 3 (only supports specific aspect ratios)
    let aspectRatio = "1:1";

    const requestBody = {
        instances: [
            {
                prompt: prompt
            }
        ],
        parameters: {
            sampleCount: 1,
            aspectRatio: aspectRatio,
            personGeneration: "ALLOW_ADULT"
        }
    };

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:predict?key=${apiKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal
    });

    if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(`Gemini error ${resp.status}: ${data?.error?.message || resp.statusText}`);
    }

    const data = await resp.json();
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (b64) {
        // Gemini returns JPEG by default for base64 output
        return { blob: b64ToBlob(b64, "image/jpeg"), mime: "image/jpeg" };
    } else {
        throw new Error("No image data returned from Gemini");
    }
}

export async function generateAndSetActorImage(actor, apiKey, options) {
    const { blob, mime } = await generateImageOpenAI(apiKey, options);
    await saveAndSetActor(actor, blob, "final", options.saveDir, options.storageSrc, mime);
}

export async function generateAndSetGeminiActorImage(actor, apiKey, options) {
    const { blob, mime } = await generateImageGemini(apiKey, options);
    await saveAndSetActor(actor, blob, "final", options.saveDir, options.storageSrc, mime);
}

export async function generateAndSaveItemImage(itemName, apiKey, model, options) {
    let result;
    if (model === "imagen-3") {
        result = await generateImageGemini(apiKey, options);
    } else {
        result = await generateImageOpenAI(apiKey, options);
    }

    const filenameSlug = (s) => s?.toLowerCase?.().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
    const base = filenameSlug(itemName);
    const ext = result.mime === "image/jpeg" ? "jpg" : "png";
    const filename = `${base}-${Date.now()}-icon.${ext}`;

    return await uploadBlobToFoundry(result.blob, filename, options.saveDir, options.storageSrc, result.mime);
}

export async function saveAndSetActor(actor, blob, tag, saveDir, storageSrc, mime = "image/png") {
    const filenameSlug = (s) => s?.toLowerCase?.().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "token";
    const base = filenameSlug(actor.name);
    const ext = mime === "image/jpeg" ? "jpg" : "png";
    const filename = `${base}-${Date.now()}-${tag}.${ext}`;

    const filePath = await uploadBlobToFoundry(blob, filename, saveDir, storageSrc, mime);

    await actor.update({
        "img": filePath,
        "prototypeToken.texture.src": filePath
    });

    if (actor.isToken) {
        await actor.token.update({ "texture.src": filePath });
    } else {
        const tokens = actor.getActiveTokens();
        for (const token of tokens) {
            await token.document.update({ "texture.src": filePath });
        }
    }

    return filePath;
}

export async function uploadBlobToFoundry(blob, filename, directory, source = "data", mime = "image/png") {
    directory = directory.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/(^\/|\/$)/g, "");
    const file = new File([blob], filename, { type: mime });
    await ensureDirectoryExists(source, directory);
    const result = await FilePicker.upload(source, directory, file, { notify: false });
    if (!result?.path) throw new Error("Upload failed: no path returned.");
    return result.path;
}

export async function ensureDirectoryExists(source, dir) {
    const segments = dir.split("/").filter(Boolean);
    let current = "";
    for (const seg of segments) {
        const next = current ? `${current}/${seg}` : seg;
        let exists = true;
        try { await FilePicker.browse(source, next); }
        catch { exists = false; }
        if (!exists) {
            await FilePicker.createDirectory(source, next).catch(async () => {
                await FilePicker.browse(source, next);
            });
        }
        current = next;
    }
}

export function b64ToBlob(b64Data, contentType = "image/png") {
    const byteChars = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteChars.length; offset += 1024) {
        const slice = byteChars.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) byteNumbers[i] = slice.charCodeAt(i);
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
}
