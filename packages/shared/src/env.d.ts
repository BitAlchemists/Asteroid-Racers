// `shared` is isomorphic: it gets neither DOM nor Node typings. Declare the few host globals it uses.
declare const console: {
  log(...data: unknown[]): void;
  warn(...data: unknown[]): void;
  error(...data: unknown[]): void;
};
