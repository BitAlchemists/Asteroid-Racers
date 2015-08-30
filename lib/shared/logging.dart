library ar_logging;

import "package:logging/logging.dart" as logging;
export "package:logging/logging.dart";

printLogRecords(logging.Logger log){
  log.onRecord.listen((logging.LogRecord record){
    print(record.loggerName + " " + record.level.toString() + ": " + record.message);
  });
}

