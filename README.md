# Vibe Actor

## Overview
**Vibe Actor** is a Foundry VTT module that leverages AI to generate, adjust, and visualize NPCs. It is part of the Vibe Project ecosystem.

## Features

### 1. AI Actor Generation
-   **Prompt-Based Creation**: Generate complete NPC statistics, biography, and features from a simple text prompt.
-   **CR & Type Support**: Specify Challenge Rating, Creature Type, and Size to guide the generation (e.g., "CR 5 Fire Elemental").
-   **Feature Integration**: Automatically generates structured data for `dnd5e` features, including actions, spells, and special traits.

### 2. Actor Adjustment
-   **Modify Existing NPCs**: Select an actor and use AI to adjust specific aspects (e.g., "Make this goblin a shaman" or "Increase CR to 3").
-   **Context-Aware**: The AI understands the actor's current state and applies changes incrementally.

### 3. AI Image Generation
-   **OpenAI DALL-E Integration**: Generate character portraits directly from the actor sheet.
-   **Seamless Workflow**: Images are automatically saved and assigned to the actor's prototype token and sheet image.

## Installation
1.  Ensure **`vibe-common`** is installed and enabled.
2.  Install **`vibe-actor`** into your `Data/modules/` directory.
3.  Enable the module in your Foundry VTT world.

## Configuration
Go to **Settings -> Configure Settings -> Vibe Actor** to set up your API keys:

-   **Gemini API Key**: Required for Actor Generation and Adjustment.
-   **OpenAI API Key**: Required for Image Generation.

> **Note**: If you are migrating from `vibe-combat`, your settings will be automatically migrated upon first launch.

## Usage

### Generating an Actor
1.  Open the **Actor Directory**.
2.  Click the **"Vibe Actor"** button in the header.
3.  Enter a prompt (e.g., "A grim dwarf warmaster with a grudge against elves").
4.  Configure optional parameters (CR, Type, Size).
5.  Click **Generate**.

### Adjusting an Actor
1.  Open an Actor Sheet.
2.  Click the **"Vibe Adjust"** button (usually in the header or near the name).
3.  Enter instructions for the adjustment.
4.  Click **Apply**.

### Generating an Image
1.  Open an Actor Sheet.
2.  Click the **"Vibe Image"** button.
3.  Review the generated prompt (or edit it).
4.  Click **Generate Image**.
