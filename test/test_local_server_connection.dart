import "package:unittest/unittest.dart";
//import "package:unittest/html_config.dart";
import "../lib/web_client/web_client.dart";
import "../lib/world_server/world_server.dart";

void main(){
  //useHtmlConfiguration();
  group("Connect", _testLocalServerConnection); 
}

_testLocalServerConnection(){
  
  setUp(()=>
  {
    
  });
  
  test("Preconditions",(){
    expect(ClientProxy.worldServer, isNull);
  });
  
  LocalServerConnection conn = new LocalServerConnection();
  conn.connect();
  
  test("Connection established", (){
    expect(ClientProxy.worldServer, isNotNull);
  });
  
  
}