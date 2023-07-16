"use strict";

var os = require("os");
var nodeStatic = require("node-static");
var http = require("http");
var socketIO = require("socket.io");

var fileServer = new nodeStatic.Server();
var app = http
  .createServer(function (req, res) {
    fileServer.serve(req, res);
  })
  .listen(8081);

var io = new socketIO.Server(app, {
  cors: {
    origin: ["http://localhost:8081", "http://localhost:3000", "https://coverdrive.cricket"],
  },
});

io.on("connection", function (socket) {
  // convenience function to log server messages on the client
  console.log('connection', socket.id)
  function log() {
    var array = ["Message from server:"];
    array.push.apply(array, arguments);
    socket.emit("log", array);
  }

  socket.on("message", function (message) {
    log("Client said: ", message);
    // for a real app, would be room-only (not broadcast)
    if (message) {
      socket.broadcast.emit("message", message);
    }
  });

  socket.on("create or join", function (room) {
    log("Received request to create or join room " + room);

    var clientsInRoom = io.of("/").adapter.rooms.get(room);
    var numClients = clientsInRoom ? clientsInRoom.size : 0;
    log("Room " + room + " currently has " + numClients + " client(s)");

    if (numClients === 0) {
      socket.join(room);
      log("Client ID " + socket.id + " created room " + room);
      socket.emit("created", room, socket.id);
    } else if (numClients >= 1) {
      log("Client ID " + socket.id + " joined room " + room);
      // io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit("joined", room, socket.id);
      socket.to(room).emit("ready", room);
      // } else { // max two clients
      //   socket.emit('full', room);
    }
    var clientsInRoom = io.of("/").adapter.rooms.get(room);
    var numClients = clientsInRoom ? clientsInRoom.size : 0;
    log("Room " + room + " now has " + numClients + " client(s)");
  });

  socket.on("ipaddr", function () {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function (details) {
        if (details.family === "IPv4" && details.address !== "127.0.0.1") {
          socket.emit("ipaddr", details.address);
        }
      });
    }
  });

  socket.on("disconnecting", function (reason) {
    console.log(`Peer or server disconnected. Reason: ${reason}.`);
    [...socket.rooms].forEach((k) => socket.to(k).emit("bye"));
  });

  socket.on("bye", function ({ room, isInitiator }) {
    console.log(`Peer said bye on room ${room}.`);
    console.log("was init", isInitiator);
    if (isInitiator) {
      try {
        let sent = false;
        [...io.of("/").adapter.rooms.get(room)].forEach((k) => {
          console.log(k);
          if (!sent && k !== socket.id) {
            socket.to(k).emit("newHost");
            sent = true;
          }
        });
      } catch {}
    }
    socket.leave(room);
  });
});
