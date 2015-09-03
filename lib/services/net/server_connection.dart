library net_connection;

import "dart:async";
import "package:asteroidracers/shared/net.dart";

abstract class ServerConnection implements Connection {    
  Future connect();
}