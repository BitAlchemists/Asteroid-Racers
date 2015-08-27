part of ai;

class AIClientProxy implements IClientProxy {

  String playerName;
  Movable movable;
  VehicleController _command;
  VehicleController get command => _command;
  set command(VehicleController command){
    if(_command != null){
      _command.client = null;
    }

    _command = command;

    if(_command != null){
      _command.client = this;
    }
  }
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
    if(command != null){
      command.step(dt);
    }
  }
}