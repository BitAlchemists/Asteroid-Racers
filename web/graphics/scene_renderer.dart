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
     vec3 center = new vec3(width / 2, height / 2, 0); 
     
     scene.entities.forEach((Entity entity) {
       entity.components.forEach( (Component component) {
         if(component is GraphicsComponent) {
           
           context.save();
           
           try {
             context.lineWidth = 0.5;
             context.fillStyle = "black ";
             context.strokeStyle = "green";

             context.beginPath();
             mat4 transform = new mat4.identity().translate(center).translate(entity.position).rotateZ(entity.orientation * Math.PI);
             
             //context.arc(position.x, position.y, 20, 0, PI * 2, false);
             vec3 vec = transform.transform3(new vec3.copy(component.vertices.last));
             context.moveTo(vec.x, vec.y);
             for(int i = 0; i < component.vertices.length; i++) {
               vec = transform.transform3(new vec3.copy(component.vertices[i]));
               context.lineTo(vec.x, vec.y);

             }
             
             context.stroke();
             context.closePath();
           } finally {
             context.restore();
           }
         }
       });
     });
   }
}


