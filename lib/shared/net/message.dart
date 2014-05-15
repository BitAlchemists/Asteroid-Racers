part of ar_shared;

class Message {
  String messageType;
  var payload;
  
  factory Message.fromJson(String json)
  {
    try {
      Message message = new Message._internal();
      var map = JSON.parse(json);
      if(map is Map) {
        message.messageType = map['messageType'];
        var payload = map['payload'];
        message.payload = JSON.parse(payload);
      }
      
      return message;
    }
    catch (e) {
      print('error during Message.fromJson(): $e');      
    }
    
    return null;
  }
  
  Message._internal();
  
  String toJson() {
    String json = null;
    try {
      var payload = JSON.stringify(this.payload);      
      Map map = {'messageType': this.messageType, 'payload': payload};
      json = JSON.stringify(map);
    }
    catch (e) {
      print('error during Message.toJson(): $e');
    }
    
    return map;
  }
}