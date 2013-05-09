part of ar_server;

class StaticFileHandler {
  final Path basePath;

  StaticFileHandler(this.basePath);

  _send404(HttpResponse response) {
    response.statusCode = HttpStatus.NOT_FOUND;
    response.close();
  }

  // TODO: etags, last-modified-since support
  onRequest(HttpRequest request) {
    final String path =
        request.uri.path == '/' ? '/index.html' : request.uri.path;
    Path filePath = basePath.append(path);
    final File file = new File(filePath.toNativePath());
    file.exists().then((bool found) {
      if (found) {
        file.fullPath().then((String fullPath) {
          if (!fullPath.startsWith(basePath.toNativePath())) {
            _send404(request.response);
          } else {
            file.openRead().pipe(request.response)
              .catchError((e) => print(e));
          }
        });
      } else {
        _send404(request.response);
      }
    });
  }
}
