part of ai;

class AIController implements IClientProxy {

  String playerName;
  Movable movable;

  AIController(this.movable, [this.playerName = "AI Dummy"]);

  void send(Message message){

  }
}