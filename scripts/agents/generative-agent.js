import { callGemini, extractJson } from "../services/gemini-service.js";
import { z } from "../libs/zod.js";
import { zodToJsonSchema } from "../utils/zod-to-json-schema.js";

export class GenerativeAgent {
    constructor(apiKey, schema) {
        this.apiKey = apiKey;
        this.schema = schema;
    }

    get systemPrompt() {
        return "You are a helpful AI assistant.";
    }

    async generate(input, options = {}) {
        const retries = options.retries || 3;
        const jsonSchema = zodToJsonSchema(this.schema);

        let currentPrompt = `${this.systemPrompt}\n\nTask Context:\n${JSON.stringify(input, null, 2)}`;
        let attempt = 0;
        let lastError = null;

        while (attempt <= retries) {
            try {
                console.log(`Vibe Actor | Agent Generation Attempt ${attempt + 1}/${retries + 1}`);

                const text = await callGemini({
                    apiKey: this.apiKey,
                    prompt: currentPrompt,
                    responseSchema: jsonSchema,
                    abortSignal: options.abortSignal
                });

                let json = extractJson(text);

                if (this.schema._def.typeName === "ZodArray" && !Array.isArray(json) && typeof json === "object") {
                    console.warn("Vibe Actor | Auto-correcting: Wrapped single object in Array to match schema.");
                    json = [json];
                }

                const result = this.schema.safeParse(json);

                if (result.success) {
                    return result.data;
                } else {
                    const issues = result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
                    lastError = `Validation Error: ${issues}`;
                    console.warn(`Vibe Actor | ${lastError}`);
                    console.warn("Vibe Actor | Invalid JSON:", JSON.stringify(json, null, 2));

                    currentPrompt += `\n\nERROR: Your previous response was invalid. \nIssues: ${issues}\n\nPlease regenerate the JSON to fix these specific errors.`;
                    attempt++;
                }

            } catch (error) {
                console.error("Vibe Actor | Generation Error:", error);
                lastError = error.message;
                attempt++;
            }
        }

        throw new Error(`Generative Agent failed after ${retries} retries. Last error: ${lastError}`);
    }
}
