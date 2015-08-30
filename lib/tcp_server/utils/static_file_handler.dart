part of tcp_server;

class StaticFileHandler {
  final List filePaths;

  StaticFileHandler(this.filePaths);

  _send404(HttpResponse response) {
    response.statusCode = HttpStatus.NOT_FOUND;
    response.write("404 - File Not Found");
    response.close();
  }

  onRequest(HttpRequest request) {
    log.finer("static file request: " + request.uri.path);

    final String localPath =
        request.uri.path == '/' ? 'asteroidracers.html' : request.uri.path.substring(1, request.uri.path.length);


    bool fileFound = false;
    for(String basePath in filePaths){
      String filePath = path.join(basePath, localPath);
      log.fine("file request for path $filePath");
      File file = new File(filePath);
      if(file.existsSync()){
        sendFileResponse(file, request);
        fileFound = true;
        break;
      }
    }
    
    if(!fileFound){
      _send404(request.response);
      print("failed to load file $localPath");
    }
  }
  
  void sendFileResponse(File file, HttpRequest request){
    // MIME type
    String mimeType = mime(file.path);
    if (mimeType == null) mimeType = 'text/plain; charset=UTF-8';
    request.response.headers.set('Content-Type', mimeType);
    // Content Length
    request.response.contentLength = file.lengthSync();
    // send response
    file.openRead().pipe(request.response).catchError((e) => print(e));
  }
}
