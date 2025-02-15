const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // to generate random strings

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const activeRooms = new Map();  // save rooms id with thier users

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  let currentRoom = null;
  let username = null;

socket.on('create room', (name) => {
    username = name;                      // when user want to create room -> input his name
    const roomId = uuidv4().substring(0, 8);
    currentRoom = roomId;                 // create a room ID 

    activeRooms.set(roomId, {             // the key : roomID and value -> 1- users Set includes users id's , 2- participants Map includes userId and username
      users: new Set([socket.id]),
      participants: new Map([[socket.id, username]])
    });

    socket.join(roomId);                  // user join the room created  
    socket.emit('room created', roomId);  // send room Id to front-end
    updateParticipants(roomId);
});

// join room handler
socket.on('join room', ({ roomId, name }) => {            // to join room required username and room id
    username = name;
    if (!activeRooms.has(roomId)) {                       // check if room id exist or not
      socket.emit('error', 'Room does not exist');
      return;
    }

    const room = activeRooms.get(roomId);                 // get room id from activeRooms Map
    // if (room.users.size >= 2) {                           // check on size of set that holds user's id
    //   socket.emit('error', 'Room is full (max 2 users)'); // allow only for 2 users
    //   return;
    // }

    currentRoom = roomId;
    room.users.add(socket.id);                           // add user's id to the Set
    room.participants.set(socket.id, username);          // add user's id and username to participents Map
    socket.join(roomId);                                 // join to the specific room with roomId
    io.to(roomId).emit('room joined', {                  // send to only roomId emit on event  
        roomId,
        participants: Array.from(room.participants.values()) // send event to front-end with data {roomId , user names of participants}
      }); 
    io.to(roomId).emit('user joined', username);            // send emit with user joined
    updateParticipants(roomId);
  });

// chat message handler
socket.on('chat message', (msg) => {
    if (currentRoom) {
        socket.broadcast.to(currentRoom).emit('chat message', {     // Broadcast to others in the room except sender
        msg,
        username,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });

  socket.on('disconnect', () => {
    if (currentRoom && activeRooms.has(currentRoom)) {
      const room = activeRooms.get(currentRoom);
      room.users.delete(socket.id);
      room.participants.delete(socket.id);        // delete userID from users Set and participants Map

      if (room.users.size === 0) {                // when users Set empty delete the room form activeRooms map
        activeRooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('user left', username);
        updateParticipants(currentRoom);
      }
    }
  });

  function updateParticipants(roomId) {
    const room = activeRooms.get(roomId);
    io.to(roomId).emit('participants update', Array.from(room.participants.values()));   // to update participants in UI
  }
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});