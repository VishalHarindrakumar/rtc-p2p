const { Server } = require("socket.io");

const io = new Server(process.env.PORT || 10000, {
  cors: true,
});

const uidToSocketIdMap = new Map();
const socketidToUidMap = new Map();
const socketIdToRoomMap = new Map();
const roomQueues = new Map();

function joinRoom(socket, room, uid) {
  const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
  
  if (roomSize < 2) {
    uidToSocketIdMap.set(uid, socket.id);
    socketidToUidMap.set(socket.id, uid);
    socketIdToRoomMap.set(socket.id, room);
    socket.join(room);
    io.to(room).emit("user:joined", { uid, id: socket.id });
    io.to(socket.id).emit("room:join", { uid, room });
    
    if (roomSize === 1) {
      // Connect the two users in the room and start streaming
      const users = Array.from(io.sockets.adapter.rooms.get(room));
      io.to(users[0]).emit("start:stream", { to: users[1] });
      io.to(users[1]).emit("start:stream", { to: users[0] });
    }
  } else {
    // Room is full, add user to queue
    if (!roomQueues.has(room)) {
      roomQueues.set(room, []);
    }
    roomQueues.get(room).push({ socket, uid });
    socket.emit("room:queued", { room });
  }
}

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("room:join", (data) => {
    const { uid, room } = data;
    joinRoom(socket, room, uid);
  });

  socket.on("stream:init", ({ to, offer }) => {
    io.to(to).emit("stream:init", { from: socket.id, offer });
  });

  socket.on("stream:accept", ({ to, ans }) => {
    io.to(to).emit("stream:accept", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("disconnecting", () => {
    const room = socketIdToRoomMap.get(socket.id);
    if (room) {
      const uid = socketidToUidMap.get(socket.id);
      socket.to(room).emit("user:left", { uid, id: socket.id });

      // Check if there's someone in the queue for this room
      if (roomQueues.has(room) && roomQueues.get(room).length > 0) {
        const nextUser = roomQueues.get(room).shift();
        joinRoom(nextUser.socket, room, nextUser.uid);
      }
    }
  });

  socket.on("disconnect", () => {
    const uid = socketidToUidMap.get(socket.id);
    const room = socketIdToRoomMap.get(socket.id);
    
    uidToSocketIdMap.delete(uid);
    socketidToUidMap.delete(socket.id);
    socketIdToRoomMap.delete(socket.id);

    // Remove the user from any room queues
    for (const [roomName, queue] of roomQueues.entries()) {
      const index = queue.findIndex(user => user.socket.id === socket.id);
      if (index !== -1) {
        queue.splice(index, 1);
        if (queue.length === 0) {
          roomQueues.delete(roomName);
        }
        break;
      }
    }

    console.log(`Socket Disconnected`, socket.id);
  });
});