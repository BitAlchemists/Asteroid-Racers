part of ai;

class AIDirector {
  World _world;

  AIDirector(this._world);

  AIController _luke;

  populateWorld(){
    Movable movable = new Movable();
    _luke = new AIController(movable);
    _world.addEntity(_luke.movable);
  }

  step(double dt){

  }
}