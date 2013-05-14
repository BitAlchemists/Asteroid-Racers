part of ar_client;

class MenuScene extends Scene {
  
  MenuRenderer renderer;
  List menuItems;
  
  MenuScene(GameLoopHtml gameLoop) {
    renderer = new MenuRenderer((gameLoop.element as CanvasElement).context2D, gameLoop.width, gameLoop.height);
    menuItems = [new MenuButton("hello"), new MenuButton("world")];
  }
  
  void onUpdate(GameLoopHtml gameLoop) {
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