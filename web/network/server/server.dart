library server;

import 'dart:io';
import 'dart:isolate';
import 'dart:async';
import 'src/file-logger.dart' as log;
import 'src/server-utils.dart';

part 'src/static_file_handler.dart';
part 'src/connection_handler.dart';

runServer(Path basePath, int port) {
  ConnectionHandler connectionHandler = new ConnectionHandler(basePath);
  StaticFileHandler fileHandler = new StaticFileHandler(basePath);
  
  HttpServer.bind('127.0.0.1', port)
    .then((HttpServer server) {
      print('listening for connections on $port');
      
      var sc = new StreamController();
      sc.stream.transform(new WebSocketTransformer()).listen(connectionHandler.onConnection);

      server.listen((HttpRequest request) {
        if (request.uri.path == '/ws') {
          sc.add(request);
        } else {
          fileHandler.onRequest(request);
        }
      });
    },
    onError: (error) => print("Error starting HTTP server: $error"));
}

main() {
    File script = new File(new Options().script);
    Directory directory = script.directorySync();
    Path basePath = new Path(directory.path);
    runServer(basePath, 1337);    
}
