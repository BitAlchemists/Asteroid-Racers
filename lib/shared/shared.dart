library ar_shared;

import 'dart:convert';
import 'dart:math' as Math;
import "dart:async";
import "package:vector_math/vector_math.dart";

import "net/envelope.pb.dart";
export "net/envelope.pb.dart";
export "net/movement_input.pb.dart";
export "net/handshake.pb.dart";
export "net/remove_entity_command.pb.dart";
export "net/collision_message.pb.dart";

//net
part "net/connection.dart";

//world
part "world/world.dart";
part "world/entity.dart";
part "world/movable.dart";
part "world/checkpoint.dart";
part "world/race_portal.dart";
part 'world/physics_simulator.dart';

String exceptionDetails(e){
  assert(e != null);
  
  String result = "exceptionDetails for error of type: ${e.runtimeType.toString()}\n";

  if(e is String)
  {
    result += e;
  }

  if(e is Error){
    result += "error message: ${e.toString()}\n";
    
    if(e is JsonUnsupportedObjectError){
      result += "${e.cause}\nUnsupportedObject:${e.unsupportedObject.runtimeType.toString()}\n";
    }
    
    result += e.stackTrace.toString();
  }
  
  result += "----";
  
  return result;    
}