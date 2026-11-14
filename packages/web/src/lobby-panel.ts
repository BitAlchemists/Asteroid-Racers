import type { RunningGame } from "@ar/client";
import type { LobbyStatus } from "@ar/node/track-categories";
import { MessageType, type MessageHandler } from "@ar/shared";

/** Refresh interval of the lobby state (GET /lobby is cheap, like /health). */
const POLL_MS = 4000;
/** Who lobby messages come from in the chat (LOBBY_SENDER in track-lobby.ts). */
const LOBBY_SENDER = "Lobby";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

/**
 * The multiplayer HUD's track box: the current track, the next one (by vote or rotation) and a
 * "Vote" button that opens the race tracks; a tap votes (it sends `/vote <track>` in the chat, so
 * the vote belongs to this connection). Fed by `GET /lobby`, refreshed on every lobby message. On a
 * fixed-track server it just names the track.
 */
export function mountLobbyPanel(game: RunningGame, lobbyUrl: string): void {
  const current = el("p", "hud-lobby-line");
  const next = el("p", "hud-lobby-line");
  const toggle = el("button", "hud-button hud-lobby-toggle", "Vote next track");
  toggle.type = "button";
  const list = el("div", "hud-lobby-list");
  list.hidden = true;
  const box = el("section", "hud-window hud-lobby", current, next, toggle, list);
  box.setAttribute("aria-label", "Tracks");
  box.hidden = true;
  game.hud.root.append(box);

  let status: LobbyStatus | undefined;
  let myVote: string | undefined;
  let listKey = "";

  const line = (target: HTMLElement, label: string, name: string, note = "") => {
    target.replaceChildren(
      `${label} `,
      el("strong", "", name),
      note ? el("span", "hud-lobby-note", ` ${note}`) : "",
    );
  };

  const render = () => {
    if (!status) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    line(current, "Track:", status.current.name, status.fixed ? "(fixed)" : "");
    current.title = status.current.blurb;
    if (status.fixed) {
      next.hidden = toggle.hidden = list.hidden = true;
      return;
    }
    next.hidden = toggle.hidden = false;
    const votes = status.votes[status.next.name];
    line(
      next,
      "Next:",
      status.next.name,
      status.next.by === "vote"
        ? `(${votes} vote${votes === 1 ? "" : "s"}${status.waiting ? ", after the current race" : ""})`
        : status.waiting
          ? "(after the current race)"
          : "(rotation)",
    );
    next.title = status.next.blurb;
    // Rebuild the buttons only when they change, so a poll never swaps one away under a finger.
    const key = JSON.stringify([status.current.name, status.votes, myVote]);
    if (key === listKey) return;
    listKey = key;
    list.replaceChildren(
      ...status.tracks.map((track) => {
        const n = status!.fixed ? 0 : (status!.votes[track.name] ?? 0);
        const button = el(
          "button",
          "hud-lobby-vote",
          `${track.name}${n ? ` · ${n} vote${n === 1 ? "" : "s"}` : ""}${track.name === status!.current.name ? " (now)" : ""}`,
          el("small", "", track.blurb),
        );
        button.type = "button";
        button.classList.toggle("mine", track.name === myVote);
        button.classList.toggle("current", track.name === status!.current.name);
        button.addEventListener("click", () => {
          button.blur(); // give the keyboard back to the game
          myVote = track.name;
          game.client.server.sendChat(`/vote ${track.name}`);
          list.hidden = true;
          toggle.textContent = "Vote next track";
          render();
        });
        return button;
      }),
    );
  };

  toggle.addEventListener("click", () => {
    toggle.blur();
    list.hidden = !list.hidden;
    toggle.textContent = list.hidden ? "Vote next track" : "Close";
  });

  let inFlight = false;
  const refresh = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const response = await fetch(lobbyUrl, { cache: "no-store" });
      const previous = status?.current.name;
      status = response.ok ? ((await response.json()) as LobbyStatus) : undefined;
      if (status && previous && status.current.name !== previous) myVote = undefined; // votes reset
    } catch {
      status = undefined; // an older server without /lobby, or offline: no box
    } finally {
      inFlight = false;
    }
    render();
  };

  // Lobby chat lines (votes, switches) refresh the box at once; the poll covers the rest.
  const dispatcher = game.client.server.dispatcher;
  const chat = dispatcher.handler(MessageType.CHAT) as MessageHandler<MessageType.CHAT, void> | undefined;
  dispatcher.on(MessageType.CHAT, (message, context, envelope) => {
    chat?.(message, context, envelope);
    if (message.from === LOBBY_SENDER) void refresh();
  });
  void refresh();
  setInterval(() => void refresh(), POLL_MS);
}

/** `GET /lobby` of the server behind a WebSocket URL (`wss://host/ws` → `https://host/lobby`). */
export function lobbyUrlFor(webSocketUrl: string): string {
  const url = new URL(webSocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = url.pathname.replace(/\/ws$/, "") + "/lobby";
  url.search = "";
  return url.toString();
}
