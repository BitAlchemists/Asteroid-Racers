library game_server_client_proxy;

import "dart:math" as Math;

import "package:asteroidracers/shared/net.dart";
import "package:asteroidracers/shared/world.dart" as world;
import "package:asteroidracers/shared/shared_server.dart";

class ClientProxy implements IClientProxy
{
  final Connection _connection;
  static IGameServer gameServer;
  static final Map<String, MessageHandler> _messageHandlers = 
    {
      MessageType.HANDSHAKE: _onHandshake,
      MessageType.INPUT: _onPlayerInput,
      MessageType.PING_PONG: _onPingPong,
    };
  
  world.Movable movable;

  // IClientProxy
  String get playerName => movable.displayName;
  
  ClientProxy(this._connection){
    _connection.onReceiveMessage.listen(onMessage);
    _connection.onDisconnectDelegate = _onDisconnect;
  }
  
  static void registerMessageHandler(MessageType messageType, MessageHandler messageHandler){
    _messageHandlers[messageType.name] = messageHandler;
  }
  
  _onDisconnect([e]){
    gameServer.disconnectClient(this);
  }
  
  void send(Envelope envelope) {
    _connection.send(envelope);
  }
  
  void onMessage(Envelope envelope){
    try {      
      if(envelope.messageType == null) {
        print("message type == null");
        //TODO: disconnect this client
        return;
      }
      
      MessageHandler messageHandler = _messageHandlers[envelope.messageType];
      
      if(messageHandler != null){
        messageHandler(this, envelope);
      }
      else {
        print("no appropriate message handler for messageType ${envelope.messageType} found.");
      }            
    }
    catch (e, stack)
    {
      print("exception during ClientProxy.onMessage: ${e.toString()}");
      if(envelope.messageType != null){
        print("affected message type: ${envelope.messageType}");
        print("stack:\n$stack");
      }
    }
  }
  
  static _onHandshake(IClientProxy client, Envelope handshakeEnvelope)
  {
    Handshake handshake = new Handshake.fromBuffer(handshakeEnvelope.payload);
    String username = handshake.username;
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
                    "Drei-Zimmer-Rakete",
                    "Major Tom"];
      int index = new Math.Random().nextInt(names.length);
      username = names[index];
    }
    
    //create player entity in world
    gameServer.registerPlayer(client, username);

    Envelope envelope = Envelope.create();
    envelope.messageType = MessageType.PLAYER;
    envelope.payload = EntityMarshal.worldEntityToNetEntity(client.movable).writeToBuffer();
    client.send(envelope);

    //send all entities
    for(world.Entity entity in gameServer.world.entities.values){
      //TODO: add queueing here to make sure we don't overload the client after handshake
      Envelope envelope = Envelope.create();
      envelope.messageType = MessageType.ENTITY;
      envelope.payload = EntityMarshal.worldEntityToNetEntity(entity).writeToBuffer();
      client.send(envelope);
    }
  }
  
  static _onPlayerInput(IClientProxy client, Envelope envelope){
    MovementInput input = new MovementInput.fromBuffer(envelope.payload);
    
    if(!client.movable.canMove){
      print("client sent player update during !canMove");
      return;
    }
    
    gameServer.computePlayerInput(client, input);
  }
    
  static _onPingPong(ClientProxy client, Envelope envelope){
    //print("ping ${message.payload} from ${client.movable.displayName}");
    client.send(envelope);
  }
}