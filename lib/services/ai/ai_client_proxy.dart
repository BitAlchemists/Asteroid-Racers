part of ai;

class AIClientProxy implements IClientProxy {

  String playerName;
  Movable movable;
  CommandInstance currentCommandInstance;
  IGameServer server;

  AIClientProxy();

  void send(net.Envelope envelope){
    if(envelope.messageType == net.MessageType.COLLISION){
      net.IntMessage message = new net.IntMessage.fromBuffer(envelope.payload);
      if(message.integer == movable.id){
        // :P
      }
    }
  }

  void step(double dt){
    currentCommandInstance.command.step(currentCommandInstance, dt);
  }
}