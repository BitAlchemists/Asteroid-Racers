part of ar_shared;

class Message {
  String messageType;
  var payload;
  
  Message();
  
  factory Message.fromJson(String json)
  {
    try {
      Message message = new Message._internal();
      var map = JSON.decode(json);
      if(map is Map) {
        message.messageType = map['messageType'];
        message.payload = map['payload'];
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
      Map map = {'messageType': this.messageType, 'payload': payload};
      json = JSON.stringify(map);
    }
    catch (e) {
      print('error during Message.toJson(): $e');
    }
    
    return json;
  }
}