import { ConnectionState } from "@ar/shared";
import type { Hud, HudActions } from "../game/contracts";

/** Lines kept in the chat log (the Dart client showed the last 5). */
export const CHAT_LINES = 5;
const USERNAME_KEY = "asteroid-racers.username";

const CONNECT_LABELS: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Connect",
  [ConnectionState.CONNECTING]: "Connecting…",
  [ConnectionState.CONNECTED]: "Disconnect",
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  Object.assign(element, props);
  element.append(...children);
  return element;
}

function readStoredName(): string {
  try {
    return localStorage.getItem(USERNAME_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeName(name: string): void {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {
    // storage unavailable (private mode etc.) — the name just isn't remembered
  }
}

/**
 * The GUI as an HTML overlay (the Dart client drew these widgets on the canvas): pilot panel with
 * username, connect button and debug readout at the top left; chat across the bottom.
 */
export class HtmlHud implements Hud {
  readonly root: HTMLElement;
  private readonly usernameInput: HTMLInputElement;
  private readonly connectButton: HTMLButtonElement;
  private readonly leaveButton: HTMLButtonElement;
  private readonly debug: HTMLPreElement;
  private readonly chatLog: HTMLUListElement;
  private readonly chatInput: HTMLInputElement;

  constructor(parent: HTMLElement, actions: HudActions) {
    this.usernameInput = el("input", {
      id: "hud-username",
      type: "text",
      maxLength: 40,
      placeholder: "random ship name",
      value: readStoredName(),
      autocomplete: "off",
    });
    this.usernameInput.addEventListener("change", () => storeName(this.usernameInput.value.trim()));
    this.usernameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.usernameInput.blur();
    });

    this.connectButton = el("button", { type: "button", className: "hud-button" }, "Connect");
    this.connectButton.addEventListener("click", () => {
      this.connectButton.blur(); // give the keyboard back to the game
      actions.onConnectToggle();
    });

    this.leaveButton = el(
      "button",
      { type: "button", className: "hud-button hud-leave", hidden: true },
      "Leave race",
    );
    this.leaveButton.addEventListener("click", () => {
      this.leaveButton.blur();
      actions.onLeaveRace();
    });

    this.debug = el("pre", { className: "hud-debug" });

    const pilot = el(
      "section",
      { className: "hud-window hud-pilot" },
      el("label", { htmlFor: "hud-username" }, "Username:"),
      this.usernameInput,
      this.connectButton,
      this.leaveButton,
      this.debug,
    );

    this.chatLog = el("ul", { className: "hud-chat-log" });
    this.chatLog.setAttribute("aria-live", "polite");
    this.chatInput = el("input", {
      type: "text",
      maxLength: 500,
      placeholder: "Chat — press Enter to send, Esc to return to the game",
      autocomplete: "off",
    });
    this.chatInput.setAttribute("aria-label", "Chat message");
    this.chatInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        actions.onChatSubmit(this.chatInput.value);
        this.chatInput.value = "";
      } else if (event.key === "Escape") {
        this.chatInput.blur();
      }
    });
    const chat = el("section", { className: "hud-window hud-chat" }, this.chatLog, this.chatInput);

    this.root = el("div", { className: "hud" }, pilot, chat);
    parent.append(this.root);
  }

  get username(): string {
    const name = this.usernameInput.value.trim();
    storeName(name);
    return name;
  }

  setConnectionState(state: ConnectionState): void {
    this.connectButton.textContent = CONNECT_LABELS[state];
    this.connectButton.disabled = state === ConnectionState.CONNECTING;
  }

  setDebugText(text: string): void {
    if (this.debug.textContent !== text) this.debug.textContent = text;
  }

  showChat(from: string, text: string): void {
    this.append(el("li", {}, el("strong", {}, `${from}: `), text));
  }

  showNotice(text: string): void {
    this.append(el("li", { className: "hud-notice" }, `[system]: ${text}`));
  }

  setInRace(inRace: boolean): void {
    this.leaveButton.hidden = !inRace;
  }

  toggleVisible(): void {
    this.root.hidden = !this.root.hidden;
  }

  private append(line: HTMLLIElement): void {
    this.chatLog.append(line);
    while (this.chatLog.children.length > CHAT_LINES) this.chatLog.firstElementChild?.remove();
  }
}
