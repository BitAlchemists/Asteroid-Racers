import { ConnectionState } from "@ar/shared";
import type { Hud, HudActions } from "../game/contracts";
import {
  menuDialog,
  menuForcedOpen,
  panelButtons,
  runMenuAction,
  type GameMode,
  type MenuAction,
  type MenuNavigation,
  type MenuState,
} from "./game-menu";

/** Lines kept in the chat log (the Dart client showed the last 5). */
export const CHAT_LINES = 5;
/** The start page keeps the player name under this key (menu.ts). */
const USERNAME_KEY = "asteroid-racers.username";

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
    return localStorage.getItem(USERNAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export interface HtmlHudOptions {
  mode: GameMode;
  navigation: MenuNavigation;
}

/**
 * The GUI as an HTML overlay: a small panel at the top left ("☰ Menu", "Leave race" while racing in
 * multiplayer, the debug readout), the chat across the bottom, and the menu dialog (game-menu.ts
 * says what it offers per mode). The dialog sits outside `root`, so it still works with the HUD
 * hidden ("1"), and it opens by itself when the multiplayer connection is lost.
 */
export class HtmlHud implements Hud {
  readonly root: HTMLElement;
  /** The menu dialog (a sibling of `root`). */
  readonly menu: HTMLElement;
  private readonly menuButton: HTMLButtonElement;
  private readonly panelActions: HTMLElement;
  private readonly debug: HTMLPreElement;
  private readonly chatLog: HTMLUListElement;
  private readonly chatInput: HTMLInputElement;
  private readonly menuTitle: HTMLHeadingElement;
  private readonly menuMessage: HTMLParagraphElement;
  private readonly menuButtons: HTMLElement;
  private state: MenuState;
  private menuOpen = false;
  /** What panel and dialog show; they are rebuilt only when it changes (no button swapped under a finger). */
  private shown = "";

  constructor(
    parent: HTMLElement,
    private readonly actions: HudActions,
    private readonly options: HtmlHudOptions,
  ) {
    this.state = { mode: options.mode, connection: ConnectionState.DISCONNECTED, inRace: false };

    this.menuButton = el("button", { type: "button", className: "hud-button hud-menu-button" }, "☰ Menu");
    this.menuButton.title = "Game menu (Esc)";
    this.menuButton.setAttribute("aria-haspopup", "dialog");
    this.menuButton.addEventListener("click", () => {
      this.menuButton.blur(); // give the keyboard back to the game
      this.toggleMenu();
    });
    this.panelActions = el("div", { className: "hud-panel-actions" });
    this.debug = el("pre", { className: "hud-debug" });
    const pilot = el(
      "section",
      { className: "hud-window hud-pilot" },
      this.menuButton,
      this.panelActions,
      this.debug,
    );
    pilot.setAttribute("aria-label", "Game");

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

    this.menuTitle = el("h2", { id: "game-menu-title" });
    this.menuMessage = el("p", { className: "game-menu-message" });
    this.menuButtons = el("div", { className: "game-menu-buttons" });
    const panel = el(
      "section",
      { className: "game-menu-panel" },
      this.menuTitle,
      this.menuMessage,
      this.menuButtons,
    );
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "game-menu-title");
    this.menu = el("div", { className: "game-menu", hidden: true }, panel);
    // A tap on the dimmed backdrop closes the menu, like Esc.
    this.menu.addEventListener("click", (event) => {
      if (event.target === this.menu) this.closeMenu();
    });

    parent.append(this.root, this.menu);
    this.render();
  }

  get username(): string {
    return readStoredName();
  }

  get isMenuOpen(): boolean {
    return this.menuOpen || menuForcedOpen(this.state);
  }

  setConnectionState(connection: ConnectionState): void {
    // Back on the server: the "connection lost" dialog has done its job.
    if (connection === ConnectionState.CONNECTED && this.state.lost !== undefined) this.menuOpen = false;
    const lost = connection === ConnectionState.CONNECTED ? undefined : this.state.lost;
    this.state = { ...this.state, connection, lost };
    this.render();
  }

  connectionLost(reason: string): void {
    this.state = { ...this.state, lost: reason, inRace: false };
    this.render();
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
    this.state = { ...this.state, inRace };
    this.render();
  }

  toggleVisible(): void {
    this.root.hidden = !this.root.hidden;
  }

  toggleMenu(): void {
    if (this.isMenuOpen) this.closeMenu();
    else this.openMenu();
  }

  openMenu(): void {
    this.menuOpen = true;
    this.render();
  }

  closeMenu(): void {
    if (menuForcedOpen(this.state)) return;
    this.menuOpen = false;
    this.render();
  }

  private run(action: MenuAction): void {
    if (runMenuAction(action, this.actions, this.options.navigation)) this.closeMenu();
  }

  private render(): void {
    const panel = panelButtons(this.state);
    const open = this.isMenuOpen;
    const dialog = open ? menuDialog(this.state) : undefined;
    const key = JSON.stringify([panel, dialog]);
    if (key === this.shown) return;
    this.shown = key;

    this.panelActions.replaceChildren(...panel.map((b) => this.button(b.action, b.label, "hud-button")));
    this.menuButton.setAttribute("aria-expanded", String(open));
    this.menu.hidden = !dialog;
    document.body.classList.toggle("game-menu-open", open);
    if (!dialog) return;
    this.menuTitle.textContent = dialog.title;
    this.menuMessage.textContent = dialog.message;
    this.menuButtons.replaceChildren(
      ...dialog.buttons.map((b) => {
        const button = this.button(b.action, b.label, `game-menu-button game-menu-${b.action}`);
        button.disabled = !!b.disabled;
        return button;
      }),
    );
    // Keyboard users land on the first choice (Resume, or Reconnect); Esc closes.
    (this.menuButtons.querySelector("button:not(:disabled)") as HTMLButtonElement | null)?.focus({
      preventScroll: true,
    });
  }

  private button(action: MenuAction, label: string, className: string): HTMLButtonElement {
    const button = el("button", { type: "button", className }, label);
    button.dataset.action = action;
    button.addEventListener("click", () => {
      button.blur(); // give the keyboard back to the game
      this.run(action);
    });
    return button;
  }

  private append(line: HTMLLIElement): void {
    this.chatLog.append(line);
    while (this.chatLog.children.length > CHAT_LINES) this.chatLog.firstElementChild?.remove();
  }
}
