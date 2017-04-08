import "dart:async";
import "package:asteroidracers/shared/net.dart";
import "package:logging/logging.dart" as logging;
import "package:asteroidracers/shared/logging.dart";

logging.Logger log;

main() {
  log = new logging.Logger("");
  log.level = logging.Level.INFO;
  registerLogging(log);

  int i = 0;

  StreamController<Envelope> sc = new StreamController<Envelope>();
  sc.stream.listen(_onData);

  Future.doWhile((){
    i++;
    if(i%100000 == 0){
      log.info((i/100000).toString());
    }
    Envelope envelope = new Envelope();
    envelope.messageType = MessageType.ENTITY;
    Entity entity = new Entity();
    entity.type = 3;
    entity.id = 123;
    entity.displayName = "Fritz";
    entity.position = new Vector2();
    entity.position.x = 34.56;
    entity.position.y = 345.53;
    entity.movable = new Entity_Movable();
    envelope.payload = entity.writeToBuffer();
    sc.add(envelope);
    return true;
  });
}

_onData(var data){
  int pi = 3;
  pi = 4;
  return pi;
}