v0.7 - Node.js / TypeScript port
------

+ Port the whole game from Dart 1.x to TypeScript on Node.js (npm workspaces: shared, server, client, node, web)
+ PixiJS renderer replaces StageXL; the GUI is an HTML overlay
+ Same protobuf wire protocol, now via @bufbuild/protobuf
+ Node host with WebSocket game traffic and static file serving; singleplayer runs the server in the page
+ Neuro-evolution bots ported, trainer runs headless at ~28x real time with 100 bots at once; bots race in singleplayer and multiplayer
+ Fix: the network bias neuron always output 0
+ Fix: training bots crashed into each other and saw their own ship about once a second
+ Fix: connection listeners are released on disconnect (memory leak), checked by soak tests
+ CI with typecheck, lint, format check, tests, build and a short training run

v0.6 - 
------

+ Add Favicon
+ Add Window class, add UIHelper static class
+ Add UI visibility toggle
+ Fixed Dart-JS source maps import
+ chat added to fullscreen ui
+ rename world_server to game_server
+ introduce service architecture to allow modularization of game services
+ introduce ChatServer service
+ Split GameClient into GameClient and GameRenderer #18
+ change enumerations from class type to enum. #22
+ players spawn anywhere in a checkpoint (no longer in the middle)
+ control over physics is held by the server #16
