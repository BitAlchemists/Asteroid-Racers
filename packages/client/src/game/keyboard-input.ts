import type { GameClient } from "./game-client";

const LEFT = new Set(["ArrowLeft", "KeyA"]);
const RIGHT = new Set(["ArrowRight", "KeyD"]);
const THRUST = new Set(["ArrowUp", "KeyW"]);
const TOGGLE_GUI = "Digit1";

/**
 * Keyboard steering for the local ship (arrow keys, or WASD) and "1" to toggle the GUI.
 * Keys typed into text fields (username, chat) are ignored.
 */
export function bindKeyboard(target: Window, client: GameClient, toggleGui: () => void): () => void {
  const held = new Set<string>();

  const isTyping = (event: KeyboardEvent) => {
    const el = event.target as HTMLElement | null;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  };

  const applyRotation = () => {
    const player = client.player;
    if (!player) return;
    const left = [...LEFT].some((k) => held.has(k));
    const right = [...RIGHT].some((k) => held.has(k));
    if (left && !right) player.rotateLeft();
    else if (right && !left) player.rotateRight();
    else player.stopRotation();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTyping(event)) return;
    if (event.code === TOGGLE_GUI) {
      if (!event.repeat) toggleGui();
      return;
    }
    if (!LEFT.has(event.code) && !RIGHT.has(event.code) && !THRUST.has(event.code)) return;
    event.preventDefault();
    held.add(event.code);
    if (THRUST.has(event.code) && client.player) client.player.accelerationFactor = 1;
    applyRotation();
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (!held.delete(event.code)) return;
    if (THRUST.has(event.code) && ![...THRUST].some((k) => held.has(k)) && client.player) {
      client.player.accelerationFactor = 0;
    }
    applyRotation();
  };

  // Releasing keys while the window is unfocused would otherwise leave the ship turning forever.
  const onBlur = () => {
    held.clear();
    if (client.player) client.player.accelerationFactor = 0;
    applyRotation();
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  return () => {
    target.removeEventListener("keydown", onKeyDown);
    target.removeEventListener("keyup", onKeyUp);
    target.removeEventListener("blur", onBlur);
  };
}
