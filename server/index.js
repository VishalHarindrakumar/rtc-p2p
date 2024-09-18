const { Server } = require("socket.io");
const { Room, User, Stats } = require('./db');

const io = new Server(process.env.PORT || 10000, {
  cors: true,
});

const uidToSocketIdMap = new Map();
const socketidToUidMap = new Map();
const socketIdToRoomMap = new Map();
const roomQueues = new Map();

async function updateStats() {
  const totalRooms = await Room.countDocuments();
  const totalUsers = await User.countDocuments();
  const successfulCalls = await Room.countDocuments({ callSuccessful: true });
  const droppedCalls = await Room.countDocuments({ callSuccessful: false, endedAt: { $ne: null } });
  
  const peakConcurrentUsers = Math.max(
    (await Stats.findOne() || {}).peakConcurrentUsers || 0,
    await User.countDocuments({ leftAt: null })
  );

  const mostPopularRoom = await Room.aggregate([
    { $group: { _id: "$roomId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 }
  ]);

  await Stats.findOneAndUpdate({}, {
    totalRooms,
    totalUsers,
    successfulCalls,
    droppedCalls,
    peakConcurrentUsers,
    mostPopularRoom: mostPopularRoom[0]?._id
  }, { upsert: true });
}

async function joinRoom(socket, room, uid) {
  const roomSize = io.sockets.adapter.rooms.get(room)?.size || 0;
  
  if (roomSize < 2) {
    uidToSocketIdMap.set(uid, socket.id);
    socketidToUidMap.set(socket.id, uid);
    socketIdToRoomMap.set(socket.id, room);
    socket.join(room);
    
    await Room.findOneAndUpdate(
      { roomId: room },
      { $inc: { userCount: 1 } },
      { upsert: true }
    );
    
    await User.create({ userId: uid, socketId: socket.id, roomId: room });
    
    io.to(room).emit("user:joined", { uid, id: socket.id });
    io.to(socket.id).emit("room:join", { uid, room });
    
    if (roomSize === 1) {
      const users = Array.from(io.sockets.adapter.rooms.get(room));
      io.to(users[0]).emit("user:connected", { to: users[1] });
      io.to(users[1]).emit("user:connected", { to: users[0] });
    }
  } else {
    if (!roomQueues.has(room)) {
      roomQueues.set(room, []);
    }
    roomQueues.get(room).push({ socket, uid });
    socket.emit("room:queued", { room });
  }
  
  await updateStats();
}

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);

  socket.on("fetch:stats", async () => {
    try {
      const stats = await Stats.findOne();
      if (stats) {
        socket.emit("stats:update", stats);
      } else {
        // If no stats are found, send default values
        socket.emit("stats:update", {
          totalRooms: 0,
          totalUsers: 0,
          successfulCalls: 0,
          droppedCalls: 0,
          peakConcurrentUsers: 0,
          mostPopularRoom: 'N/A'
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      socket.emit("stats:error", "Failed to fetch statistics");
    }
  });

  socket.on("room:join", async (data) => {
    const { uid, room } = data;
    await joinRoom(socket, room, uid);
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", async ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
    const room = socketIdToRoomMap.get(socket.id);
    await Room.findOneAndUpdate({ roomId: room }, { callSuccessful: true });
    await updateStats();
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("disconnecting", async () => {
    const room = socketIdToRoomMap.get(socket.id);
    if (room) {
      const uid = socketidToUidMap.get(socket.id);
      socket.to(room).emit("user:left", { uid, id: socket.id });

      await User.findOneAndUpdate(
        { socketId: socket.id },
        { leftAt: new Date() }
      );

      await Room.findOneAndUpdate(
        { roomId: room },
        { $inc: { userCount: -1 } }
      );

      if (roomQueues.has(room) && roomQueues.get(room).length > 0) {
        const nextUser = roomQueues.get(room).shift();
        await joinRoom(nextUser.socket, room, nextUser.uid);
      } else {
        await Room.findOneAndUpdate(
          { roomId: room },
          { endedAt: new Date() }
        );
      }
    }
    await updateStats();
  });

  socket.on("disconnect", async () => {
    const uid = socketidToUidMap.get(socket.id);
    const room = socketIdToRoomMap.get(socket.id);
    
    uidToSocketIdMap.delete(uid);
    socketidToUidMap.delete(socket.id);
    socketIdToRoomMap.delete(socket.id);

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
    await updateStats();
  });
});