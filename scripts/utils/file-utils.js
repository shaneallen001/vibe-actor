/**
 * File Utils
 * Helpers for file system and path validation
 */

/**
 * Validates if an image path exists and is accessible.
 */
export async function validateImagePath(path) {
    if (!path) return false;

    if (typeof window === "undefined" || typeof foundry === "undefined") {
        return true;
    }

    try {
        const response = await fetch(path, { method: "HEAD" });
        return response.ok;
    } catch (error) {
        console.warn(`Vibe Actor | Failed to validate image path: ${path}`, error);
        return false;
    }
}
