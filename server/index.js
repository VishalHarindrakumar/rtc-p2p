const {Server}=require("socket.io")

const io = new Server(8000, {
    cors: true,
});

const userToSocketIdMap = new Map();
const socketidToUserMap = new Map();

io.on('connection',socket=>{
    console.log(`Socket Connected ${socket.id}`)


    socket.on("room:join",(data)=>{
        const{username,room}=data;
        
        userToSocketIdMap.set(username,socket.id);
        socketidToUserMap.set(socket.id,username);
        io.to(socket.id).emit("room:join",data)
    })
});