part of web_client;

class ExplosionState {
  static const int CHILLAXING = 0;
  static const int EXPLODING = 1;
  static const int IMPLODING = 2;
}

class PlayerController extends EntityController implements stagexl.Animatable  {
  final double _maxPlayerSpeed = 100.0;
  final double _rotationSpeed = 10.0;
  
  int explosionState = ExplosionState.EXPLODING;
  double explosionScale = 0.1;
  stagexl.Sprite _explosion;
  
  PlayerController(entity) : super(entity); 

  stagexl.Sprite _createSprite(Entity entity) {
    stagexl.Sprite sprite = super._createSprite(entity);
    
    _explosion = new stagexl.Sprite();
    RenderHelper.applyExplosion(_explosion.graphics, entity.radius);
    sprite.addChild(_explosion);
    
    return sprite;
  }
  
  bool advanceTime(num dt){
    
    switch(explosionState){
      case ExplosionState.EXPLODING:
        explosionScale += dt * 10;
        if(explosionScale >= 3.0){
          explosionScale = 3.0;
          explosionState = ExplosionState.IMPLODING;
        }
        break;
      case ExplosionState.IMPLODING:
        explosionScale -= dt * 3;
        if(explosionScale <= 0.1){
          explosionScale = 0.1;
          explosionState = ExplosionState.CHILLAXING;
        }        
        break;
    }
    
    _explosion.rotation += dt;
    
    _explosion.scaleX = explosionScale;
    _explosion.scaleY = explosionScale;
    
    return true;
  }
  
  void triggerExplosion(){
    explosionState = ExplosionState.EXPLODING;
  }
  
  void rotateLeft(){
    _entity.rotationSpeed = -_rotationSpeed;
  }
  
  void rotateRight(){
    _entity.rotationSpeed = _rotationSpeed;
  }
  
  void accelerateForward() {
    _accelerate(new Vector2(0.0, _maxPlayerSpeed));
  }
  
  void accelerateBackward() {
    _accelerate(new Vector2(0.0, - _maxPlayerSpeed));
  }
  
  void _accelerate(Vector2 direction){

    //TODO: this can most propably be calculated in a simpler way. do it!
    Vector3 acceleration3 = 
      new Matrix4.identity().
      rotateZ(_entity.orientation).
      translate(direction.x, direction.y).
      getTranslation();
    
    _entity.acceleration = new Vector2(acceleration3.x, acceleration3.y);
  }
}