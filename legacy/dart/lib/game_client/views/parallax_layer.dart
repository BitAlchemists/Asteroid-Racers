part of game_client;

class ParallaxLayer extends stagexl.Sprite implements stagexl.Animatable {

  final stagexl.Stage stage;
  Vector2 parallaxOffset = new Vector2.zero();
  double parallaxFactor = 0.3;
    
  ParallaxLayer(this.stage, this.parallaxFactor) : super();
  
  bool advanceTime(num dt){ 
    this.x = stage.stageWidth/2.0 - parallaxOffset.x * parallaxFactor;
    this.y = stage.stageHeight/2.0 - parallaxOffset.y * parallaxFactor;      
    
    return true;
  }
}
