part of ar_client;

class PlayerController extends EntityController  {
  final double _maxPlayerSpeed = 100.0;
  final double _rotationSpeed = 10.0;


  PlayerController(Entity entity) : super(entity) {
    RenderHelper.applyTriangle(_sprite.graphics);
  }
 

  static num count = 0;
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
      rotateZ(_entity.orientation * Math.PI).
      translate(direction.x, direction.y).
      getTranslation();
    
    _entity.acceleration = new Vector2(acceleration3.x, acceleration3.y);
  }
}