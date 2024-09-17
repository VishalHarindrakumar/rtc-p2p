const { Server } = require("socket.io");

const io = new Server(process.env.PORT || 10000, {
  cors: true,
});

const uidToSocketIdMap = new Map();
const socketidToUidMap = new Map();
const socketIdToRoomMap = new Map();

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("room:join", (data) => {
    const { uid, room } = data;
    uidToSocketIdMap.set(uid, socket.id);
    socketidToUidMap.set(socket.id, uid);
    socketIdToRoomMap.set(socket.id, room);
    io.to(room).emit("user:joined", { uid, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("disconnecting", () => {
    const room = socketIdToRoomMap.get(socket.id);
    if (room) {
      const uid = socketidToUidMap.get(socket.id);
      socket.to(room).emit("user:left", { uid, id: socket.id });
    }
  });

  socket.on("disconnect", () => {
    const uid = socketidToUidMap.get(socket.id);
    const room = socketIdToRoomMap.get(socket.id);
    
    uidToSocketIdMap.delete(uid);
    socketidToUidMap.delete(socket.id);
    socketIdToRoomMap.delete(socket.id);

    console.log(`Socket Disconnected`, socket.id);
  });
});