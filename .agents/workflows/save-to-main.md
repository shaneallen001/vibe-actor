---
description: save to main, bump version, and release
---

When the user asks to "save to main", "release", or similar, follow these steps to release the current module(s):

1. **Verify State**: Ensure there are no uncommitted changes, or commit them first on the current development branch.
2. **Review `module.json` and `CHANGELOG.md` or `README.md`**:
   - Bump the `version` value in `module.json` to the next appropriate version (e.g., from `1.0.0` to `1.1.0`).
   - Add a new section in `CHANGELOG.md` with the new version number and summarize the recent changes.
3. **Commit Version Bump**:
   // turbo
   `git add module.json CHANGELOG.md`
   // turbo
   `git commit -m "chore: version bump and changelog update"`
4. **Merge to Main**: Checkout the `main` branch and merge the development branch into it.
   // turbo
   `git checkout main`
   // turbo
   `git merge <dev-branch-name>`
5. **Tag the Release**: Create an annotated git tag for the new version.
   // turbo
   `git tag -a v<new-version> -m "Release v<new-version>"`
6. **Push to Remote**: Push the `main` branch and its tags to the origin.
   // turbo
   `git push origin main --tags`
7. **Return to Dev Branch**: Switch back to the development branch (and push it if there were new commits).
   // turbo
   `git checkout <dev-branch-name>`
   // turbo
   `git push origin <dev-branch-name>`
