library world;

import 'dart:convert';
import "package:vector_math/vector_math.dart";
export "package:vector_math/vector_math.dart";

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