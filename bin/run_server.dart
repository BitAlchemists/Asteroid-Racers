import '../lib/tcp_server/tcp_server.dart';
import "package:path/path.dart" as path;

bool UNSAFE_DEVELOPMENT_ENVIRONMENT = true;

main() {
  String serverPath = path.current;
  serverPath = path.dirname(serverPath);
  serverPath = path.join(serverPath, "build/web/");
  
  String gameRoot = path.current;
  gameRoot = path.dirname(gameRoot);
  
  List lookupPaths = [serverPath];
  if(UNSAFE_DEVELOPMENT_ENVIRONMENT){
    lookupPaths.add(gameRoot);
  }
  
  print("serverpath: $serverPath");
  runServer(lookupPaths, null, 1337);    
}
