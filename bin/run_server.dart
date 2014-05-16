import 'dart:io';
import '../lib/tcp_server/tcp_server.dart';
import "package:path/path.dart" as path;

main() {
    String serverPath = path.dirname(path.dirname(Platform.script.path.toString()));
    serverPath = path.join(serverPath, "build/web/");
    runServer(serverPath, null, 1337);    
}