part of world_server;

typedef void MessageHandler(ClientProxy client, Message message);

class ClientProxy
{
  final Connection _connection;
  static WorldServer worldServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.CHAT: onChatMessage,
      MessageType.HANDSHAKE: onHandshake,
      MessageType.PLAYER: onPlayerUpdate
    };
  Entity playerEntity;
  
  ClientProxy(this._connection){
    _connection.onReceiveMessage.listen(onMessage);
    _connection.onDisconnectDelegate = _onDisconnect;
  }
  
  _onDisconnect([e]){
    worldServer.disconnectClient(this);
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
    catch (e)
    {
      print("exception during ClientProxy.onMessage: ${e.toString()}");
      if(message.messageType != null){
        print("affected message type: ${message.messageType}");  
      }
    }
  }
  
  static onHandshake(ClientProxy client, Message message)
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
                    "Eage",
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
                    "TARDIS"];
      int index = new Math.Random().nextInt(names.length);
      username = names[index];
    }
    
    //create player entity in world
    client.playerEntity = worldServer.registerPlayer(client, username);
    
    //send all entities
    for(Entity entity in worldServer.world.entities.values){
      if(entity == client.playerEntity) {
        client.send(new Message(MessageType.PLAYER, entity));
      }
      else {
        client.send(new Message(MessageType.ENTITY, entity));        
      }
    }
  }
  
  static onChatMessage(ClientProxy client, Message message)
  {
    worldServer.broadcastFromPlayer(client, message);
  }
  
  static onPlayerUpdate(ClientProxy client, Message message){
    Entity entity = new Entity.fromJson(message.payload);

    if(client.playerEntity.id != entity.id){
      print("client attempting to update entity other than itself");
      worldServer.disconnectClient(client);
      return;
    }
    
    worldServer.updatePlayerEntity(client, entity);
  }
}