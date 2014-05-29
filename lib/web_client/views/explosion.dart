part of web_client;

class Explosion extends stagexl.Sprite implements stagexl.Animatable {
  
  Function _onComplete;
  static const int _EXPLODING = 1;
  static const int _IMPLODING = 2;

  int _explosionState = _EXPLODING;
  double _explosionScale = 0.1;
  
  Explosion(this._onComplete) : super();  
  
  bool advanceTime(num dt){
    
    switch(_explosionState){
      case _EXPLODING:
        _explosionScale += dt * 10;
        if(_explosionScale >= 3.0){
          _explosionScale = 3.0;
          _explosionState = _IMPLODING;
        }
        break;
      case _IMPLODING:
        _explosionScale -= dt * 3;
        if(_explosionScale <= 0.1){
          _explosionScale = 0.1;
          _onComplete(this);
        }        
        break;
    }
    
    this.rotation += dt;
    
    this.scaleX = _explosionScale;
    this.scaleY = _explosionScale;
    
    return true;  
  }
      
  
  static renderExplosion(
          stagexl.Stage stage,
          stagexl.Sprite target, 
          double radius){
    
    _onComplete(Explosion explosion){
      stage.juggler.remove(explosion);
      explosion.removeFromParent();
    }
    
    Explosion explosion = new Explosion(_onComplete);
    RenderHelper.applyExplosion(explosion.graphics, radius);
    
    target.addChild(explosion);
    stage.juggler.add(explosion);
  }
  
}