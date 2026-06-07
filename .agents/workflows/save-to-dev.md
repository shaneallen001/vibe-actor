---
description: save to dev branch, commit and push without releasing
---

When the user asks to "save to dev", "commit to dev", or similar, follow these steps to save the current progress without doing a full release:

1. **Verify State**: Check `git status` in the relevant repositories to see what changes are pending.
2. **Commit Changes**: Add all changes and commit with an appropriate message summarizing the work done. If the user didn't specify a message, use a generic one like "chore: save progress".
   // turbo
   `git add .`
   // turbo
   `git commit -m "chore: save progress"`
3. **Push to Remote**: Push the current development branch to the origin.
   // turbo
   `git push origin HEAD`
