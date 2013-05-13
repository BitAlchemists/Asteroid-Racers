library ar_server;

import 'dart:io';
import 'dart:isolate';
import 'dart:async';

import '../shared/ar_shared.dart';

import 'utils/file-logger.dart' as log;
import 'utils/server-utils.dart';

part 'utils/static_file_handler.dart';
part 'net/server_connection_handler.dart';

runServer(Path basePath, int port) {
  ServerConnectionHandler connectionHandler = new ServerConnectionHandler(basePath);
  StaticFileHandler fileHandler = new StaticFileHandler(basePath);
  
  HttpServer.bind('127.0.0.1', port)
    .then((HttpServer server) {
      print('listening for connections on $port');
      
      //we will hand over new connections to the connectionHandler.onConnection method
      var sc = new StreamController();
      sc.stream.transform(new WebSocketTransformer()).listen(connectionHandler.onConnection);

      //begin to listen for connections
      server.listen((HttpRequest request) {
        if (request.uri.path == '/ws') {
          //requests to /ws are routed to the connectionHandler
          sc.add(request);
        } else {
          //other requests are treated as file requests
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
