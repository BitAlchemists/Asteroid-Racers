library ar_server;

import 'dart:io';
//import 'dart:isolate';
import 'dart:async';
import 'package:path/path.dart' as path;

//import '../core/shared/ar_shared.dart';

//import '../_needs_refactoring/file-logger.dart' as log;
import 'utils/server-utils.dart';

part 'utils/static_file_handler.dart';
part 'net/server_connection_handler.dart';

Future runServer(String webPath, String logPath, int port) {
  ServerConnectionHandler connectionHandler = new ServerConnectionHandler(logPath);
  StaticFileHandler fileHandler = new StaticFileHandler(webPath);
  
  return HttpServer.bind('127.0.0.1', port).then((HttpServer server) {
    print('listening for connections on $port');
      
    //we will hand over new connections to the connectionHandler.onConnection method
    var sc = new StreamController();
    sc.stream.transform(new WebSocketTransformer()).listen(connectionHandler.onConnection);

    //begin to listen for connections
    server.listen((HttpRequest request) {
      try {
        if (request.uri.path == '/ws') {
          //requests to /ws are routed to the connectionHandler
          sc.add(request);
        } else {
          //other requests are treated as file requests
          fileHandler.onRequest(request);
        }        
      }
      catch(e) {
        print("catching error " + e.toString());
        request.response.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        request.response.write("500 - Internal Server Error");
      }
    });
  },
  onError: (error) => print("Error starting HTTP server: $error"));
}
