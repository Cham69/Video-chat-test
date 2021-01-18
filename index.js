'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const formatMessage = require('./utils/messages'); 
const {userLeave ,getRoomUsers,userJoin, getCurrentUser} = require('./utils/users'); 

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000 || process.env.PORT, ()=> console.log("Server listening at port 3000"));

const botName = 'Epsychiatry';
var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  //console.log("A client connected");

  socket.on('disconnect', ()=>{
    const user = userLeave(socket.id);
    if(user && user.room){
      console.log(user);
      io.to(user.room)
      .emit('chatMessage', formatMessage(botName,`${user.username} has left the chat`));

      io.to(user.room)
      .emit('messageTone', formatMessage(botName,`${user.username} has left the chat`));

       io.to(user.room).emit('roomUsers', {
          room: user.room,
          users:getRoomUsers(user.room)
      }) 
  }
    
    console.log('Client disconnected');
  })

  socket.on('create or join', ({username, room})=> {
    

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      const user = userJoin(socket.id, username, room);
      socket.join(user.room);
      socket.emit('chatMessage', formatMessage(botName, 'Welcome to Epsychiatry'));
      console.log('Client ID ' + socket.id + ' created room ' + user.room);
      socket.emit('created', user.room, socket.id);
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users:getRoomUsers(user.room)
    }) 

    } else if (numClients === 1) {
      const user = userJoin(socket.id, username, room);
      console.log('Client ID ' + socket.id + ' joined room ' + user.room);
      io.sockets.in(user.room).emit('join', user.room);
      socket.join(user.room);
      socket.emit('chatMessage', formatMessage(botName, 'Welcome to Epsychiatry'));
      socket.broadcast.
        to(user.room).
        emit('chatMessage', formatMessage(botName, `${user.username} has joined the chat`)); 
        socket.to(user.room).emit('messageTone', formatMessage(botName,"msg"));
        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users:getRoomUsers(user.room)
      }) 
      socket.emit('joined', room, socket.id);
      io.sockets.in(user.room).emit('ready')
    }
    else { // max two clients
      const user = userJoin(socket.id, username, room);
      user.room = 'error';
      socket.emit('full', room);
    }
  });

  //Catching the chat messages came from a client
  socket.on('chatMessage', (msg)=>{
    //Get the user who sent this message
    const user = getCurrentUser(socket.id);
    //Sends the message to the all connected clients
    io.to(user.room).emit('chatMessage', formatMessage(user.username,msg));
    socket.to(user.room).emit('messageTone', formatMessage(user.username,msg));
})

socket.on('message', function(message) {
  var user = getCurrentUser(socket.id);
  //console.log(user.room);
    socket.to(user.room).emit('message', message);
  
  //log('Client said: ', message);
  // for a real app, would be room-only (not broadcast)
  
});

//clicked on call button
socket.on('clickCall', ()=>{
  var user = getCurrentUser(socket.id);
  socket.to(user.room).emit('clickCall');
})

//Clicked on Hangup button
socket.on('clickHangup',()=>{
  var user = getCurrentUser(socket.id);
  socket.to(user.room).emit('clickHangup');
})

//Caller clicked Hangup button
socket.on("selfHangup", ()=>{
  var user = getCurrentUser(socket.id);
  socket.to(user.room).emit('selfHangup');
})

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });
});


