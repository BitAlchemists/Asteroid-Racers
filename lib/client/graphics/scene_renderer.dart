part of ar_client;


class SceneRenderer {
  num width;
  num height;
  CanvasRenderingContext2D context;
  Scene scene;
  Camera camera;
  
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
     vec3 center = new vec3(width / 2, height / 2, 0.0) - camera.entity.position; 
     
     scene.entities.forEach((Entity entity) {
       context.save();
           
       try {
         context.lineWidth = 0.5;
         context.fillStyle = "black";
         context.strokeStyle = entity.renderChunk.color;

         context.beginPath();
         mat4 transform = new mat4.identity().translate(center).translate(entity.position).rotateZ(entity.orientation * Math.PI);
             
         //context.arc(position.x, position.y, 20, 0, PI * 2, false);
         vec3 vec = transform.transform3(new vec3.copy(entity.renderChunk.vertices.last));
         context.moveTo(vec.x, vec.y);
         for(int i = 0; i < entity.renderChunk.vertices.length; i++) {
           vec = transform.transform3(new vec3.copy(entity.renderChunk.vertices[i]));
           context.lineTo(vec.x, vec.y);
         }
             
         context.stroke();
         context.closePath();
       } finally {
         context.restore();
       }
     });
   }
}


