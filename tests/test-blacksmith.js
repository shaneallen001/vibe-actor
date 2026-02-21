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

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Please set the GEMINI_API_KEY environment variable. Example: $env:GEMINI_API_KEY='your_key_here'; npm run test:blacksmith");
    process.exit(1);
}

// Dynamically import the agent after setting up environment
const { BlacksmithAgent } = await import('../scripts/agents/blacksmith-agent.js');

async function runTest() {
    const agent = new BlacksmithAgent(apiKey);

    // Example test request
    const requests = [
        {
            name: "Breath of the Ancient Dragon",
            type: "action",
            description: "A devastating 60ft cone of fire that deals 8d6 damage. Targets must succeed on a DC 15 Dexterity saving throw or take full damage, half on success."
        },
        {
            name: "Uncanny Dodge",
            type: "reaction",
            description: "When an attacker that you can see hits you with an attack, you can use your reaction to halve the attack's damage against you."
        }
    ];

    const context = {
        creatureName: "Test Environment Creature",
        cr: 5,
        stats: {
            abilities: { str: 10, dex: 16, con: 14, int: 10, wis: 12, cha: 10 }
        },
        requests: requests
    };

    console.log("Starting Generation using BlacksmithAgent...");
    const opts = { generateImage: false, createItem: false };

    try {
        const items = await agent.generate(context, opts);

        console.log("\n=========================");
        console.log("GENERATION COMPLETE");
        console.log("=========================\n");

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const outPath = path.join(__dirname, 'output-blacksmith.json');

        fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
        console.log(`Saved output to ${outPath}`);

        console.log("Compare this json to the reference jsons in Example JSONs/Official/");
    } catch (err) {
        console.error("Test failed:", err);
    }
}

runTest();
