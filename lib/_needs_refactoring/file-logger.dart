/*
library filelogger;
import 'dart:isolate';
import 'dart:io';
import 'package:asteroidracers/server/utils/server-utils.dart';


startLogging(ReceivePort _receivePort) {
  print('started logger');
  File logFile;
  IOSink out;
  _receivePort.listen((msg) {
    if (logFile == null) {
      print("Opening file $msg");
      logFile = new File(msg);
      logFile.createSync();
      out = logFile.openWrite(mode: FileMode.APPEND);
    } else {
      time('write to file', () {
        out.write("${new DateTime.now()} : $msg\n");
      });
    }
  });
}

SendPort _loggingPort;


void log(String message) {
  _loggingPort.send(message);
}

void initLogging(String logFileName) {
  //_loggingPort = Isolate.spawn(startLogging);
  //_loggingPort.send(logFileName.toNativePath());
}
*/