part of web_client;


class PlayerController extends EntityController implements stagexl.Animatable  {
  final double _acceleration = 200.0;
  final double _rotationSpeed = 5.0;
  bool accelerate = false;
    
  stagexl_particle.ParticleEmitter _particleEmitter;
  stagexl_particle.ParticleEmitter get particleEmitter => _particleEmitter;
  
  var particleConfig = {
                        "maxParticles": 20,
                        "duration": 0.1,
                        "lifeSpan": 0.9,
                        "lifespanVariance": 0.4,
                        "startSize": 10,
                        "startSizeVariance": 20,
                        "finishSize": 70,
                        "finishSizeVariance": 0,
                        "shape": "circle",
                        "emitterType": 0,
                        "location": {
                          "x": 0,
                          "y": 0
                        },
                        "locationVariance": {
                          "x": 0,
                          "y": 0
                        },
                        "speed": 100,
                        "speedVariance": 10,
                        "angle": 270,
                        "angleVariance": 10,
                        "gravity": {
                          "x": 0,
                          "y": 0
                        },
                        "radialAcceleration": 20,
                        "radialAccelerationVariance": 0,
                        "tangentialAcceleration": 10,
                        "tangentialAccelerationVariance": 0,
                        "minRadius": 0,
                        "maxRadius": 100,
                        "maxRadiusVariance": 0,
                        "rotatePerSecond": 0,
                        "rotatePerSecondVariance": 0,
                        "compositeOperation": "source-over",
                        "startColor": {
                          "red": 1,
                          "green": 0.75,
                          "blue": 0,
                          "alpha": 1
                        },
                        "finishColor": {
                          "red": 1,
                          "green": 0,
                          "blue": 0,
                          "alpha": 0
                        }
                      };
  
  PlayerController(entity, _stage) : super(entity){
    _particleEmitter = new stagexl_particle.ParticleEmitter(particleConfig);
    _particleEmitter.setEmitterLocation(0, -5);
    _particleEmitter.stop(false);
    
    
    _stage.onKeyDown.listen((stagexl.KeyboardEvent ke){
      switch(ke.keyCode)
      {
        case html.KeyCode.LEFT:
          this.rotateLeft(); 
          break; 
          
        case html.KeyCode.RIGHT:      
          this.rotateRight();
          break; 
          
        case html.KeyCode.UP:        
          accelerate = true;
          break; 
      }
    });
    
    _stage.onKeyUp.listen((stagexl.KeyboardEvent ke){
      switch(ke.keyCode)
      {
        case html.KeyCode.LEFT:
          this.stopRotation(); 
          break; 
          
        case html.KeyCode.RIGHT:      
          this.stopRotation();
          break; 
          
        case html.KeyCode.UP:        
          accelerate = false;
          break; 
      }
    });
  }
  
  bool advanceTime(num dt){
    num angle = (this.entity.orientation / Math.PI / 2 * 360 - 90) % 360;
    particleConfig["angle"] = angle;
    _particleEmitter.updateConfig(particleConfig);
    _particleEmitter.setEmitterLocation(this.entity.position.x, this.entity.position.y);
        
    if(accelerate){
      _particleEmitter.start();
      _accelerate(new Vector2(0.0, _acceleration));
    }
    else
    {
      _particleEmitter.stop(false);
      _accelerate(new Vector2.zero());
    }
    
    _particleEmitter.advanceTime(dt);

    return true;
  }
    
  void rotateLeft(){
    _entity.rotationSpeed = -_rotationSpeed;
  }
  
  void rotateRight(){
    _entity.rotationSpeed = _rotationSpeed;
  }
  
  void stopRotation(){
    _entity.rotationSpeed = 0.0;
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
  
  updateFromServer(Entity entity){
    //we only accept updates that reactivate our player
    if(_entity.canMove == false){
      super.updateFromServer(entity);
    }
  }
}