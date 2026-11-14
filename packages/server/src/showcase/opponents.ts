import { createEnvelope, getLogger, MessageType } from "@ar/shared";
import type { GameServer } from "../game-server";
import { DemoDirector } from "../ai/directors";
import type { ModelStore } from "../ai/model-store";
import type { MajorTom } from "../ai/network";
import { RaceTargetScript, ScriptState } from "../ai/scripts";
import { DEFAULT_OPPONENT, loadShowcaseModel, showcaseModelInfo } from "./models";

const log = getLogger("services.ai.Opponents");

/**
 * Which model the racing bots fly (D1). The default is what the game always used (the bundled
 * model, or the Node server's trained `db/` model); a player can pick a showcase model instead.
 *
 * On a shared server the bots are shared, so the choice is per server, like a lobby setting:
 * - the latest choice wins (a player who joins with `?opponent=` makes it; joining without one
 *   changes nothing);
 * - it never cuts into a race: while any human is in the race, the switch waits, and happens as
 *   soon as no human is racing (the chat says so both times). The bots then leave and come back at
 *   once with the new model;
 * - when the last player has left, the bots go back to the default.
 */
export interface OpponentChoice {
  /** The id flown now (`default` or a showcase model id). */
  readonly current: string;
  /** The id the bots switch to once no human is racing, if it differs from `current`. */
  readonly pending: string | undefined;
  /** Asks for model `id` (unknown ids are ignored, returning false). */
  choose(id: string): boolean;
  /**
   * A player joins, with `id` as their choice or null for none. The returned function marks them
   * gone: when the last player is gone, the default comes back.
   */
  join(id: string | null): () => void;
}

const choices = new WeakMap<GameServer, OpponentChoice>();

/** The opponent choice of a server set up with {@link registerRacingBots}, if any. */
export function opponentChoice(server: GameServer): OpponentChoice | undefined {
  return choices.get(server);
}

export interface RacingBotsOptions {
  bots?: number;
  /** The store and name of the default model (default: the bundled model). */
  defaultStore?: ModelStore;
  defaultName?: string;
  /** The model to start with (default: the default model). */
  opponent?: string | null;
  /** Head start of human players, as in {@link RaceTargetScript} (default 5 s). */
  delaySeconds?: number;
}

/** The bots' name: "Major Tom" with the default model, else with the model's id. */
export function botName(id: string, i: number, bots: number): string {
  const base = bots === 1 ? "Major Tom" : `Major Tom ${i + 1}`;
  return id === DEFAULT_OPPONENT ? base : `${base} (${id})`;
}

/**
 * Racing bots like {@link registerAIRacingService}, whose model can be switched at run time. With
 * no opponent chosen they fly exactly the model registerAIRacingService would.
 */
export function registerRacingBots(
  server: GameServer,
  { bots = 1, defaultStore, defaultName, opponent = null, delaySeconds = 5 }: RacingBotsOptions = {},
): OpponentChoice {
  let current = opponent && showcaseModelInfo(opponent) ? opponent : DEFAULT_OPPONENT;
  let pending: string | undefined;
  const store: ModelStore = {
    load(): MajorTom[] | undefined {
      if (current !== DEFAULT_OPPONENT) return [loadShowcaseModel(current)!];
      if (defaultStore && defaultName) return defaultStore.load(defaultName);
      return [loadShowcaseModel(DEFAULT_OPPONENT)!];
    },
    save() {
      throw new Error("the opponent store is read-only");
    },
  };
  const director = new DemoDirector(DEFAULT_OPPONENT, store);
  const scripts = new Set<RaceTargetScript>();
  for (let i = 0; i < bots; i++)
    director.scriptFactories.push((network) => {
      for (const s of scripts) if (s.state === ScriptState.ENDED) scripts.delete(s);
      const script = new RaceTargetScript(network, delaySeconds, botName(current, i, bots));
      scripts.add(script);
      return script;
    });
  server.registerService(director);

  const say = (text: string) =>
    server.broadcastMessage(createEnvelope(MessageType.CHAT, { from: "server", text }));
  const label = (id: string) => showcaseModelInfo(id)!.label;

  /** True while a human (not one of these bots) is in the race. */
  const humanRacing = (): boolean => {
    const race = server.raceController;
    if (!race) return false;
    const botShips = new Set([...scripts].flatMap((s) => (s.client?.ship ? [s.client.ship.id] : [])));
    return race.players.some((p) => p.movable !== undefined && !botShips.has(p.movable.id));
  };

  const apply = () => {
    if (pending === undefined) return;
    current = pending;
    pending = undefined;
    log.info(`racing bots now fly ${current}`);
    // The director's loops load the model again as soon as their scripts end.
    director.stopAll();
    say(`The racing bots now fly ${label(current)}.`);
  };

  server.registerService({
    update() {
      if (pending !== undefined && !humanRacing()) apply();
    },
  });

  let players = 0;
  const choice: OpponentChoice = {
    get current() {
      return current;
    },
    get pending() {
      return pending;
    },
    choose(id) {
      if (!showcaseModelInfo(id)) {
        log.info(`unknown opponent ${JSON.stringify(id)}, keeping ${current}`);
        return false;
      }
      if (id === current) {
        pending = undefined;
        return true;
      }
      if (id === pending) return true;
      pending = id;
      if (humanRacing()) say(`The racing bots will fly ${label(id)} once the current race is over.`);
      else apply();
      return true;
    },
    join(id) {
      players++;
      if (id) choice.choose(id);
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        players--;
        if (players === 0) choice.choose(DEFAULT_OPPONENT);
      };
    },
  };
  choices.set(server, choice);
  return choice;
}
