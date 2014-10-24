part of game_client;

class ParallaxLayer extends stagexl.Sprite implements stagexl.Animatable {
  GameClient gameController;
  
  double parallaxFactor = 0.3;
    
  ParallaxLayer(this.gameController, this.parallaxFactor) : super();
  
  bool advanceTime(num dt){ 
    if(gameController.player != null){
      this.x = gameController.stage.stageWidth/2.0 - gameController.player.sprite.x * parallaxFactor;
      this.y = gameController.stage.stageHeight/2.0 - gameController.player.sprite.y * parallaxFactor;      
    }
    
    return true;
  }
}
