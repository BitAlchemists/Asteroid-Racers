library ar_logging;

import "package:logging/logging.dart" as logging;
export "package:logging/logging.dart";

registerLogging(logging.Logger log){
  log.onRecord.listen((logging.LogRecord record){
    print(record.time.toString() + " " + record.level.toString() + " " + record.loggerName + ": " + record.message);
  });
}

