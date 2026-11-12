import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/logging.dart";
//import 'package:asteroidracers/tcp_server/tcp_server.dart';


main() async {
  logging.Logger log = new logging.Logger("");
  log.level = logging.Level.INFO;
  registerLogging(log);
}