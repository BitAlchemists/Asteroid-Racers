import '../lib/tcp_server/tcp_server.dart';
import "package:path/path.dart" as path;
import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/logging.dart";


main() async {
  logging.Logger log = new logging.Logger("");
  log.level = logging.Level.INFO;
  registerLogging(log);

  String rootPath = path.current;
  var serverPath = path.join(rootPath, "web/");
  var buildServerPath = path.join(rootPath, "build/web/");

  List lookupPaths = [buildServerPath, serverPath];

  log.fine("lookupPaths: $lookupPaths");
  return runServer(lookupPaths, null, 1337);
}
