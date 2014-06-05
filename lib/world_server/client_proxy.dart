part of world_server;

typedef void MessageHandler(ClientProxy client, Message message);

class ClientProxy
{
  final Connection _connection;
  static WorldServer worldServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.CHAT: _onChatMessage,
      MessageType.HANDSHAKE: _onHandshake,
      MessageType.PLAYER: _onPlayerUpdate,
      MessageType.PING_PONG: _onPingPong,
    };
  
  Movable movable;
  RaceController race;
  
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
                    "TARDIS",
                    "ISEE-3/ICE", //http://blog.xkcd.com/2014/05/30/isee-3/
                    "XKCD-303"];
      int index = new Math.Random().nextInt(names.length);
      username = names[index];
    }
    
    //create player entity in world
    worldServer.registerPlayer(client, username);
    client.send(new Message(MessageType.PLAYER, client.movable));

    //send all entities
    for(Entity entity in worldServer.world.entities.values){
      client.send(new Message(MessageType.ENTITY, entity));        
    }
  }
  
  static _onChatMessage(ClientProxy client, Message message)
  {
    worldServer.broadcastFromPlayer(client, message);
  }
  
  static _onPlayerUpdate(ClientProxy client, Message message){
    Movable movable = new Movable.fromJson(message.payload);

    if(client.movable.id != movable.id){
      print("client attempting to update entity other than itself");
      worldServer.disconnectClient(client);
      return;
    }
    
    if(!client.movable.canMove){
      print("client sent player update during !canMove");
      return;
    }
    
    worldServer.updatePlayerEntity(client, false, updatedEntity: movable);
  }
    
  static _onPingPong(ClientProxy client, Message message){ 
    print("ping ${message.payload} from ${client.movable.displayName}");
    client.send(message);
  }
  
  teleportTo(Vector2 position, double orientation){
    movable.position = position;
    movable.orientation = orientation;
    movable.canMove = true;
    movable.velocity = new Vector2.zero();
    movable.acceleration = new Vector2.zero();
    movable.rotationSpeed = 0.0;    
  }
}