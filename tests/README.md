# Vibe Actor - Local Testing Loop

This folder contains a local Node.js testing loop that allows you to easily bypass Foundry's environment to test the output of the Gemini components (`BlacksmithAgent` for features and `ArtificerAgent` for equipment).

## Setup
You need Node 18+ installed on your system to use native `fetch`.
No additional `npm install` packages are required! The test files directly use the raw javascript and local dependencies like our bundled `zod`.

## Usage
Simply run the scripts from inside the `tests` directory via Node or NPM. You must set the `GEMINI_API_KEY` environment variable first.

### PowerShell
```powershell
$env:GEMINI_API_KEY="your-api-key"
npm run test:artificer

$env:GEMINI_API_KEY="your-api-key"
npm run test:blacksmith
```

### Bash / Zsh
```bash
GEMINI_API_KEY="your-api-key" npm run test:artificer
GEMINI_API_KEY="your-api-key" npm run test:blacksmith
```

## How It Works
These files (`test-artificer.js` and `test-blacksmith.js`) mock the necessary globals (like `foundry.utils.randomID`) so that our classes can execute cleanly outside of the VTT.

When the scripts finish, they will spit out JSON files:
- `output-artificer.json`
- `output-blacksmith.json`

You can then compare the generated JSONs alongside the reference items located in `vibe-actor/Example JSONs/Official/` to refine your system prompting or validation checks!

## Customizing the tests
To test different features or equipment, simply modify the `requests` array and `context` variables inside the two JS files, and then rerun.
