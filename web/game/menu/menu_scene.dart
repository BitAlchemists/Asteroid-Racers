part of asteroidracers;

class MenuScene extends Scene {
  
  MenuRenderer renderer;
  List menuItems;
  
  MenuScene(GameLoop gameLoop) {
    renderer = new MenuRenderer((gameLoop.element as CanvasElement).context2d, gameLoop.width, gameLoop.height);
    menuItems = [new MenuButton("hello"), new MenuButton("world")];
  }
  
  void onUpdate(GameLoop gameLoop) {
    var keys = keyDownMap.keys.where((key) => gameLoop.keyboard.isDown(key));
    
    keys.forEach((key) { 
      keyDownMap[key](gameLoop);
    }); 
  }

  void onRender(GameLoop gameLoop) {
    renderer.render(menuItems);
  }
}

class MenuButton {
  String title;
  
  MenuButton(this.title);
}