part of game_client;

class GameRenderer implements stagexl.Animatable  {


  StarBackground _background;
  ParallaxLayer _earthLayer;
  ParallaxLayer _entitiesLayer;
  ParallaxLayer _shipsLayer;
  

  //UI
  stagexl.Sprite _uiLayer;
  Button _connectButton;
  stagexl.TextField _usernameField;
  stagexl.TextField _debugOutput;
  Window _debugWindow;

  toggleGUI(){
    _uiLayer.visible = !_uiLayer.visible;
  }
}