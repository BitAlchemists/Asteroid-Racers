import '../lib/tcp_server/tcp_server.dart';
import "package:path/path.dart" as path;

main() {
  String serverPath = path.current;
  serverPath = path.dirname(serverPath);
  serverPath = path.join(serverPath, "build/web/");
  print("serverpath: $serverPath");
  runServer(serverPath, null, 1337);    
}
