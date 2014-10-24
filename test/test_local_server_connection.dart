import "package:unittest/unittest.dart";
//import "package:unittest/html_config.dart";
import "../lib/web_client/web_client.dart";
import "package:asteroidracers/game_server/game_server.dart";

void main(){
  //useHtmlConfiguration();
  group("Connect", _testLocalServerConnection); 
}

_testLocalServerConnection(){
  
  setUp(()=>
  {
    
  });
  
  test("Preconditions",(){
    expect(ClientProxy.gameServer, isNull);
  });
  
  LocalServerConnection conn = new LocalServerConnection();
  conn.connect();
  
  test("Connection established", (){
    expect(ClientProxy.gameServer, isNotNull);
  });
  
  
}