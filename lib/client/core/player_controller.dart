part of ar_client;

class PlayerController  {
  final double _maxPlayerSpeed = 100.0;
  final double _rotationSpeed = 10.0;

  Entity _entity;
  Entity get entity => _entity;
  
  stagexl.Sprite _sprite;
  stagexl.Sprite get sprite => _sprite;

  PlayerController(Vector2 position) {
    _entity = new Entity(position);
    _sprite = new stagexl.Sprite();
    updateSprite();
    RenderChunk.applyTriangle(_sprite.graphics);
  }
  
  updateSprite(){
    _sprite.x = _entity.position.x;
    _sprite.y = _entity.position.y;
    
    _sprite.rotation = _entity.orientation;
  }

  static num count = 0;
  void rotateLeft(){
    print("keypress: " + count.toString());
    count++;
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
      rotateZ(_entity.orientation * Math.PI).
      translate(direction.x, direction.y).
      getTranslation();
    
    _entity.acceleration = new Vector2(acceleration3.x, acceleration3.y);
  }
}