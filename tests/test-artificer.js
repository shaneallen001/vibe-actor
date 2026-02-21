import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Mock Foundry globally
global.foundry = {
    utils: {
        randomID: (len = 16) => {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            let result = "";
            for (let i = 0; i < len; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    }
};

// We also need to mock `game` if anything accesses it (e.g. image generation, though we'll pass generateImage: false)

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Please set the GEMINI_API_KEY environment variable. Example: $env:GEMINI_API_KEY='your_key_here'; npm run test:artificer");
    process.exit(1);
}

// Dynamically import the agent after setting up environment
const { ArtificerAgent } = await import('../scripts/agents/artificer-agent.js');

async function runTest() {
    const agent = new ArtificerAgent(apiKey);

    // Example test request
    const requests = [
        {
            name: "Sword of the Eternal Flame",
            type: "weapon",
            description: "A legendary longsword that burns with a fire that can never be extinguished. It deals extra fire damage and can cast the Fireball spell once per dawn."
        },
        {
            name: "Potion of Instant Recovery",
            type: "consumable",
            description: "A very rare potion that restores 4d4+4 health and removes one level of exhaustion."
        }
    ];

    const context = {
        creatureName: "Test Environment",
        cr: 5,
        requests: requests
    };

    console.log("Starting Generation using ArtificerAgent...");
    const opts = { generateImage: false, createItem: false };

    try {
        const items = await agent.generate(context, opts);

        console.log("\n=========================");
        console.log("GENERATION COMPLETE");
        console.log("=========================\n");

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const outPath = path.join(__dirname, 'output-artificer.json');

        fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
        console.log(`Saved output to ${outPath}`);

        console.log("Compare this json to the reference jsons in Example JSONs/Official/");
    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();
