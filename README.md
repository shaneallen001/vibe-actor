# Vibe Actor

## Overview
**Vibe Actor** is a Foundry VTT module that leverages AI to generate, adjust, and visualize NPCs. It is part of the Vibe Project ecosystem.

## Features

### 1. AI Actor Generation
-   **Prompt-Based Creation**: Generate complete NPC statistics, biography, and features from a simple text prompt.
-   **Streaming Auto-writer**: Expand short concepts into rich, evocative lore with real-time text streaming directly in the dialog.
-   **CR & Type Support**: Specify Challenge Rating, Creature Type, and Size to guide the generation (e.g., "CR 5 Fire Elemental").
-   **Feature Integration**: Automatically generates structured data for `dnd5e` features, including actions, spells, and special traits.

### 2. Actor Adjustment
-   **Modify Existing NPCs**: Select an actor and use AI to adjust specific aspects (e.g., "Make this goblin a shaman" or "Increase CR to 3").
-   **Context-Aware**: The AI understands the actor's current state and applies changes incrementally.

### 3. AI Image Generation
-   **OpenAI DALL-E Integration**: Generate character portraits directly from the actor sheet.
-   **Seamless Workflow**: Images are automatically saved and assigned to the actor's prototype token and sheet image.

## Installation
1.  Ensure **`vibe-common`** is installed and enabled (vibe-actor will cleanly abort initialization and show an error notification if this dependency is missing).
2.  Install **`vibe-actor`** into your `Data/modules/` directory.
3.  Enable the module in your Foundry VTT world.

## Configuration
- **API Keys**: Configure your Gemini and OpenAI API keys in the **Vibe Common** module settings.
- **Vibe Actor Settings**: Go to **Settings -> Configure Settings -> Vibe Actor** to configure permissions for player actor generation.

## Usage

### Generating an Actor
1.  Open the **Actor Directory**.
2.  Click the **"Vibe Actor"** button in the header.
3.  Enter a prompt (e.g., "A grim dwarf warmaster with a grudge against elves").
4.  Configure optional parameters (CR, Type, Size).
5.  Optionally, toggle **Generate portrait image after creation?** and specify image generation details (Subject, Style, Transparent Background).
6.  Click **Generate**.

### Adjusting an Actor
1.  Open an Actor Sheet.
2.  Click the **"Vibe Adjust"** button (usually in the header or near the name).
3.  Enter instructions for the adjustment.
4.  Click **Apply**.

### Generating an Image (Independently)
1.  Open an Actor Sheet.
2.  Click the **"Vibe Image"** button.
3.  Review the generated prompt (or edit it) and toggle transparency.
4.  Click **Generate**.

---

## Developer Guide

### Standalone Generation APIs
Vibe Actor exposes its core generative capabilities so other modules (or macros) can independently generate magical equipment and features.

The `GeminiPipeline` class is exposed on the `vibe-actor` module API (`game.modules.get("vibe-actor").api.GeminiPipeline`).

**Methods:**
- `generateCustomFeatures(requests, context, options)`
- `generateCustomEquipment(requests, context, options)`

**Options:**
- `createItem: true`: Creates a Foundry `Item` document in the directory instead of returning raw JSON.
- `generateImage: true`: Leverages DALL-E or Imagen 3 to automatically generate an icon for the item.

### Local Testing Loop
We have included a standalone Node.js testing loop inside the [`tests/`](./tests/) directory that bypasses the Foundry UI. This allows rapid iteration and evaluation of the generative AI outputs. 

To use it:
1. Navigate to `vibe-actor/tests/`
2. Set your API key in your terminal context: `$env:GEMINI_API_KEY="your-api-key"`
3. Run `npm run test:artificer` or `npm run test:blacksmith`
4. The generated output will be saved as a JSON file in the tests directory.

Review the `tests/README.md` for more complete instructions on testing features programmatically.

For more information on module extensibility, APIs, the AI generation pipeline, and component structure, please see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Recent Changes
- Added UI notifications during the item and feature generation loops in the Gemini pipeline to provide better user feedback.
- Refined the Item generation Zod schemas and AI agent prompts (Artificer and Blacksmith) to properly structure and output `ActiveEffects` (e.g., condition applications, passive resistance bonuses) with the correct effect `type: "base"`.
- Improved Blacksmith agent instructions to prevent splitting damage mechanics out of save-based feature activities into isolated damage activities.
