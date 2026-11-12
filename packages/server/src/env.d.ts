// `server` runs in Node and in the browser (singleplayer), so it gets neither DOM nor Node typings.
// Declare the few host globals it uses; both environments provide them.
declare function setTimeout(handler: () => void, ms?: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare const performance: { now(): number };
declare function queueMicrotask(callback: () => void): void;
