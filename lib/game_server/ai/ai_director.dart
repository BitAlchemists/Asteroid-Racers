part of ai;

class AIDirector {
  IGameServer _server;
  Entity target;

  AIDirector(this._server);

  AIController _luke;

  populateWorld(){
    _luke = new AIController();
    _server.connectClient(_luke);
    _server.registerPlayer(_luke, "Luke Lametta");
  }

  step(double dt){
    _luke.makeYourMove(target);
  }
}

