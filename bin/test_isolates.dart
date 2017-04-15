import "dart:isolate";


main() async {
  ReceivePort receivePort = new ReceivePort();
  receivePort.listen(_mainReceive);
  print("main #1");
  Isolate isolate = await Isolate.spawn(entryPoint, receivePort.sendPort);
  print("main #2");
  isolate.controlPort.send("wupwupwup");
}

_mainReceive(var object){
  print("_mainReceive #1");
  print(object.toString());
  print("_mainReceive #2");
  if(object is SendPort){
    object.send("Yo!");
  }
}

entryPoint(SendPort sendPort){
  print("entryPoint #1");
  sendPort.send("Hi");
  print("entryPoint #2");
  ReceivePort receivePort = new ReceivePort();
  receivePort.listen(_isolateReceive);
  sendPort.send(receivePort.sendPort);
  print("entryPoint #3");
}

_isolateReceive(var object){
  print(object.toString());
}

