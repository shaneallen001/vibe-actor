/**
 * Add the Vibe Actor button to the Actor Directory.
 */
export function addVibeActorButton(app, html, showVibeActorDialogFn) {
  let directoryElement = null;

  if (app && app.element && app.element.length) {
    directoryElement = app.element[0];
  }

  if (!directoryElement) {
    directoryElement = document.querySelector("#actors");
  }

  if (!directoryElement) {
    directoryElement = document.querySelector(".actors-directory, [data-tab='actors']");
  }

  if (!directoryElement && html && html.length) {
    directoryElement = html[0];
  }

  if (!directoryElement) {
    console.warn("Vibe Actor: Could not find Actor Directory element");
    return;
  }

  if (directoryElement.querySelector(".vibe-actor-button")) return;

  const button = document.createElement("button");
  button.className = "vibe-actor-button";
  button.type = "button";
  button.innerHTML = '<i class="fas fa-magic"></i> Vibe Actor';

  button.addEventListener("click", () => {
    const allowPlayers = game.settings.get("vibe-actor", "allowPlayerActorGeneration");
    if (!game.user.isGM && !allowPlayers) {
      ui.notifications.warn("Only the GM can use Vibe Actor.");
      return;
    }
    showVibeActorDialogFn();
  });

  const contentArea = directoryElement.querySelector(".window-content, .directory-list") || directoryElement;
  const existingButtons = contentArea.querySelectorAll("button");
  let inserted = false;

  for (const existingButton of existingButtons) {
    const buttonText = existingButton.textContent || existingButton.innerText || "";
    if (buttonText.includes("Create") || buttonText.includes("Add")) {
      const parent = existingButton.parentNode;
      if (parent) {
        parent.insertBefore(button, existingButton.nextSibling);
        inserted = true;
        break;
      }
    }
  }

  if (!inserted) {
    const header = contentArea.querySelector(".directory-header, .header-actions, header, .window-header");
    if (header) {
      const headerButtons = header.querySelectorAll("button");
      if (headerButtons.length > 0) {
        const lastButton = headerButtons[headerButtons.length - 1];
        lastButton.parentNode.insertBefore(button, lastButton.nextSibling);
        inserted = true;
      } else {
        header.appendChild(button);
        inserted = true;
      }
    }
  }

  if (!inserted) {
    const directoryList = contentArea.querySelector(".directory-list, .directory-items");
    if (directoryList && directoryList.parentNode) {
      const buttonContainer = document.createElement("div");
      buttonContainer.style.padding = "8px";
      buttonContainer.style.borderBottom = "1px solid #e0e0e0";
      buttonContainer.appendChild(button);
      directoryList.parentNode.insertBefore(buttonContainer, directoryList);
      inserted = true;
    }
  }

  if (!inserted) {
    const buttonContainer = document.createElement("div");
    buttonContainer.style.padding = "8px";
    buttonContainer.style.borderBottom = "1px solid #e0e0e0";
    buttonContainer.appendChild(button);
    contentArea.insertBefore(buttonContainer, contentArea.firstChild);
    inserted = true;
  }

  if (inserted) {
    console.log("Vibe Actor: Button added successfully");
  } else {
    console.warn("Vibe Actor: Vibe Actor button could not be inserted");
  }
}
