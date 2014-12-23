part of ar_shared;

class Message {
  MessageType messageType;
  var payload;
  
  Message([this.messageType = null, this.payload = null]);
  
  factory Message.fromJson(String json)
  {
    try {
      Message message = new Message._internal();
      var map = JSON.decode(json);
      if(map is Map) {
        message.messageType = MessageType.values[ map['messageType'] ];
        message.payload = map['payload'];
      }
      
      return message;
    }
    catch (e) {
      print('error during Message.fromJson(), json: $json, error: $e');      
    }
    
    return null;
  }
  
  Message._internal();
  
  String toJson() {
    String json = null;
    try {   
      Map map = {'messageType': this.messageType.index, 'payload': payload};
      json = JSON.encode(map);
    }
    catch (e) {
      print("error during Message.toJson() with payload object of type '${payload.runtimeType}': $e");
    }
    
    return json;
  }
  
  String toString() => toJson();
}