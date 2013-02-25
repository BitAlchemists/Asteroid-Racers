part of asteroidracers;


class SceneRenderer {
  num width;
  num height;
  CanvasRenderingContext2D context;
  Scene scene;
  
  SceneRenderer(this.scene, this.context, this.width, this.height);
  
   void render()
   {
     drawBackground();
     drawMovables();
   }
   
   void drawBackground() {
     context.fillStyle = "black";
     context.rect(0, 0, width, height);
     context.fill();
   }

   void drawMovables() {
     scene.entities.forEach((Entity entity) {
       entity.components.forEach( (Component component) {
         if(component is GraphicsComponent) {
           component.draw(context, new vec3(width / 2, height / 2, 0)); 
         }
       });
     });
   }
}


