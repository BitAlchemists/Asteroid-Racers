import { parseArgs } from "node:util";
import { Level, setLogLevel, WebSocketServerConnection } from "@ar/shared";
import { loadModelFile } from "./model-file";
import { AIGameClient, RaceTargetScript, TICK_SECONDS, type ScriptHost } from "@ar/server";

const HELP = `Connect a racing bot to a running game server over WebSocket.

Usage: npm run bot -- [options]

  --url <ws-url>        server (default ws://localhost:1337/ws)
  --name <name>         ship name (default Major Tom)
  --model <file>        a network JSON file, or a luke.txt from the trainer (default: bundled model)
  --delay <seconds>     pause before chasing each new target (default 5)
  -h, --help`;

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "ws://localhost:1337/ws" },
    name: { type: "string", default: "Major Tom" },
    model: { type: "string" },
    brain: { type: "string" }, // old name of --model
    delay: { type: "string", default: "5" },
    help: { type: "boolean", short: "h" },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
setLogLevel("", Level.INFO);

/** A tiny stand-in for the in-server director: wall-clock timers and a 15 ms control loop. */
class RemoteHost implements ScriptHost {
  readonly server = undefined;
  createClient(name?: string): AIGameClient {
    return new AIGameClient(new WebSocketServerConnection(values.url), name);
  }
  destroyClient(): void {}
  schedule(seconds: number, callback: () => void): void {
    setTimeout(callback, seconds * 1000);
  }
}

const script = new RaceTargetScript(
  loadModelFile(values.model ?? values.brain),
  Number(values.delay),
  values.name,
);
script.host = new RemoteHost();
const control = setInterval(() => script.client?.step(TICK_SECONDS), TICK_SECONDS * 1000);
process.once("SIGINT", () => script.stop());

console.log(`${values.name} connecting to ${values.url}…`);
await script.run();
clearInterval(control);
console.log("bot disconnected");
