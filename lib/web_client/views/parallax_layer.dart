part of web_client;

class ParallaxLayer extends stagexl.Sprite implements stagexl.Animatable {
  stagexl.Stage _stage;
  
  PlayerController player;
  double parallaxFactor = 0.3;
    
  ParallaxLayer(this._stage, this.parallaxFactor) : super();
  
  bool advanceTime(num dt){ 
    if(player != null){
      this.x = _stage.stageWidth/2.0 - player.sprite.x * parallaxFactor;
      this.y = _stage.stageHeight/2.0 - player.sprite.y * parallaxFactor;      
    }
  }
}
