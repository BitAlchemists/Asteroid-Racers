import '../lib/tcp_server/tcp_server.dart';
import "package:path/path.dart" as path;


main() {
  String rootPath = path.current;
  var serverPath = path.join(rootPath, "web/");
  var buildServerPath = path.join(rootPath, "build/web/");

  List lookupPaths = [buildServerPath, serverPath];

  print("lookupPaths: $lookupPaths");
  runServer(lookupPaths, null, 1337);    
}
