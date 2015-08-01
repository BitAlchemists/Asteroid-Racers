library game_client_logger;

import "dart:async";

final ClientLogger _instance = new ClientLogger._internal();

void log(String message)
{
  _instance.log(message);
}

class ClientLogger {
  StreamController<String> _streamController;
  
  ClientLogger._internal() {
    _streamController = new StreamController<String>();
  }
  
  static ClientLogger get instance {
    return _instance;
  }
  
  Stream get stdout {
    return _streamController.stream;
  }
  
  log(String message) {
    DateTime now = new DateTime.now();
    print('$now - $message');
    _streamController.add(message);
  }  
}
/*
ClientLogger.instance.stdout.listen((String message) {
  _chatWindow.displayNotice(message);
});*/ 