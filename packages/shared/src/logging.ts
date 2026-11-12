/**
 * Small hierarchical logger mirroring Dart's `package:logging` as the original code used it:
 * dotted logger names ("services.ai.TrainingDirector"), per-logger levels that fall back to the
 * nearest configured ancestor, and one shared output sink.
 */
export enum Level {
  ALL = 0,
  FINEST = 300,
  FINER = 400,
  FINE = 500,
  CONFIG = 700,
  INFO = 800,
  WARNING = 900,
  SEVERE = 1000,
  SHOUT = 1200,
  OFF = 2000,
}

export interface LogRecord {
  level: Level;
  logger: string;
  message: string;
  time: Date;
  error?: unknown;
}

export type LogSink = (record: LogRecord) => void;
type LogMessage = string | (() => string);

const ROOT = "";
const levels = new Map<string, Level>([[ROOT, Level.INFO]]);
const loggers = new Map<string, Logger>();

export const consoleSink: LogSink = ({ level, logger, message, time, error }) => {
  const line = `${time.toISOString()} ${Level[level]} ${logger || "root"}: ${message}`;
  const out = level >= Level.SEVERE ? console.error : level >= Level.WARNING ? console.warn : console.log;
  if (error === undefined) out(line);
  else out(line, error);
};

let sink: LogSink = consoleSink;

export function setLogSink(next: LogSink): void {
  sink = next;
}

/** Sets the level for `name` and every descendant without its own level. `""` is the root. */
export function setLogLevel(name: string, level: Level): void {
  levels.set(name, level);
}

/** Removes all configured levels except root, which is reset to INFO. Mainly for tests. */
export function resetLogLevels(): void {
  levels.clear();
  levels.set(ROOT, Level.INFO);
}

export function effectiveLevel(name: string): Level {
  let current = name;
  for (;;) {
    const level = levels.get(current);
    if (level !== undefined) return level;
    if (current === ROOT) return Level.INFO;
    const dot = current.lastIndexOf(".");
    current = dot === -1 ? ROOT : current.slice(0, dot);
  }
}

export class Logger {
  constructor(readonly name: string) {}

  isLoggable(level: Level): boolean {
    return level >= effectiveLevel(this.name);
  }

  /** `message` may be a thunk so expensive strings are only built when the level is enabled. */
  log(level: Level, message: LogMessage, error?: unknown): void {
    if (!this.isLoggable(level)) return;
    const text = typeof message === "function" ? message() : message;
    sink({ level, logger: this.name, message: text, time: new Date(), error });
  }

  finest(message: LogMessage): void {
    this.log(Level.FINEST, message);
  }
  finer(message: LogMessage): void {
    this.log(Level.FINER, message);
  }
  fine(message: LogMessage): void {
    this.log(Level.FINE, message);
  }
  config(message: LogMessage): void {
    this.log(Level.CONFIG, message);
  }
  info(message: LogMessage): void {
    this.log(Level.INFO, message);
  }
  warning(message: LogMessage, error?: unknown): void {
    this.log(Level.WARNING, message, error);
  }
  severe(message: LogMessage, error?: unknown): void {
    this.log(Level.SEVERE, message, error);
  }
}

export function getLogger(name: string): Logger {
  let logger = loggers.get(name);
  if (!logger) {
    logger = new Logger(name);
    loggers.set(name, logger);
  }
  return logger;
}
