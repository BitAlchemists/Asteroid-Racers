part of game_server;

class ClientProxy implements IClientProxy
{
  final Connection _connection;
  static GameServer gameServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.HANDSHAKE: _onHandshake,
      MessageType.INPUT: _onPlayerInput,
      MessageType.PING_PONG: _onPingPong,
    };
  
  Movable movable;
  RaceController race;
  
  // IClientProxy
  String get playerName => movable.displayName;
  
  ClientProxy(this._connection){
    _connection.onReceiveMessage.listen(onMessage);
    _connection.onDisconnectDelegate = _onDisconnect;
  }
  
  static void registerMessageHandler(MessageType messageType, MessageHandler messageHandler){
    _messageHandlers[messageType] = messageHandler;
  }
  
  _onDisconnect([e]){
    gameServer.disconnectClient(this);
  }
  
  void send(Message message) {
    _connection.send(message);
  }
  
  void onMessage(Message message){
    try {      
      if(message.messageType == null) {
        print("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[message.messageType];
      
      if(messageHandler != null){
        messageHandler(this, message);
      }
      else {
        print("no appropriate message handler for messageType ${message.messageType} found.");
      }            
    }
    catch (e, stack)
    {
      print("exception during ClientProxy.onMessage: ${e.toString()}");
      if(message.messageType != null){
        print("affected message type: ${message.messageType}");
        print("stack:\n$stack");
      }
    }
  }
  
  static _onHandshake(ClientProxy client, Message message)
  {
    String username = message.payload;
    if(username == null || username == ""){
      List names = ["Churchill", 
                    "Deadalus", 
                    "Explorer", 
                    "Intrepid", 
                    "Moonraker", 
                    "Pan Am Space Clipper (Orion III)", 
                    "Ranger 3", 
                    "SSTO-TAV-37B Space Shuttlecraft",
                    "X-71 Military Space Shuttle Freedom",
                    "X-71 Military Space Shuttle Independence",
                    "Aries Ib", 
                    "Eagle",
                    "Friede", 
                    "Hawk", 
                    "Mayflower One", 
                    "Projectile",
                    "Alexei Leonov", 
                    "Anastasia",
                    "Axiom", 
                    "Bilkis",
                    "F-302 Mongoose",
                    "Icarus I",
                    "Icarus II",
                    "Lauryad", 
                    "Lewis and Clark",
                    "Mars I",
                    "Mars II", 
                    "Orbit Jet", 
                    "Ryvius", 
                    "SA-43 Hammerhead Mk1", 
                    "Scorpio E-X-1", 
                    "USSC Discovery 1 (XD-1)", 
                    "USS Cygnus", 
                    "Valley Forge",
                    "Zero-X",
                    "Amaterasu (天照)",
                    "Argonaut",
                    "Ark",
                    "Basestars",
                    "Battlestar Galactica",
                    "Battlestar Pegasus",
                    "Bellerophon",
                    "C57-D",
                    "The Derelict",
                    "EAS Agamemnon",
                    "Hyperion",
                    "ISA Excalibur",
                    "Liberator",
                    "Libertad",
                    "Megazone 23",
                    "Minbari",
                    "Nemesis",
                    "Nirvana",
                    "NSEA Protector",
                    "Orbit Jet",
                    "Orion",
                    "Prometheus",
                    "SDF-1 Macross",
                    "SDF-3 Pioneer",
                    "Star Destroyer",
                    "Sulaco",
                    "Swordbreaker",
                    "Terra V",
                    "Titan",
                    "USS Enterprise",
                    "USS Saratoga",
                    "Valkyrie",
                    "Yamato",
                    "Eagle 5",
                    "Elysium",
                    "Hispania",
                    "Hunter-Gratzner",
                    "Millenium Falcon",
                    "Nostromo",
                    "Serenity",
                    "Andromeda Ascendant",
                    "Deucalion",
                    "Destiny",
                    "O'Neill",
                    "Betty",
                    "EEV - Bodenwerke Gemeinschaft Type 337 Emergency Escape Vehicle",
                    "Escape Pod",
                    "EVA Pod",
                    "Narcissus",
                    "TARDIS",
                    "ISEE-3/ICE", // http://blog.xkcd.com/2014/05/30/isee-3/
                    "XKCD-303",
                    "Drei-Zimmer-Rakete"];
      int index = new Math.Random().nextInt(names.length);
      username = names[index];
    }
    
    //create player entity in world
    gameServer.registerPlayer(client, username);
    client.send(new Message(MessageType.PLAYER, client.movable));

    //send all entities
    for(Entity entity in gameServer.world.entities.values){
      client.send(new Message(MessageType.ENTITY, entity));        
    }
  }
  
  static _onPlayerInput(ClientProxy client, Message message){
    MovementInput input = new MovementInput.fromJson(message.payload);
    
    if(!client.movable.canMove){
      print("client sent player update during !canMove");
      return;
    }
    
    gameServer.computePlayerInput(client, input);
  }
    
  static _onPingPong(ClientProxy client, Message message){ 
    //print("ping ${message.payload} from ${client.movable.displayName}");
    client.send(message);
  }
}