const { Server } = require("socket.io");

const io = new Server(8000, {
  cors: true,
});

const emailToSocketIdMap = new Map();
const socketidToEmailMap = new Map();
const socketIdToRoomMap = new Map();
var users = {};

io.on("connection", (socket) => {
  console.log(`Socket Connected`, socket.id);
  socket.on("room:join", (data) => {
    const { email, room } = data;
    emailToSocketIdMap.set(email, socket.id);
    socketidToEmailMap.set(socket.id, email);
    socketIdToRoomMap.set(socket.id, room);
    if (room in users) {
      users[room].push(socket.id)
    } else {
      users[room] = [socket.id]
    }



    io.to(room).emit("user:joined", { email, id: socket.id });
    socket.join(room);
    io.to(socket.id).emit("room:join", data);
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });//3
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });//6
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    // console.log("peer:nego:needed", offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("start:streaming", ({ to }) => {
    io.to(to).emit("start:streaming");
  })
  socket.on("left:room", () => {
    console.log("left")
  })

  socket.on("disconnect", () => {
    console.log(`Socket Disconnected`, socket.id, users);
    const roomId = socketIdToRoomMap.get(socket.id);
    if (roomId) {
      users[roomId].forEach(user => {
        if (socket.id != user) {
          socket.to(user).emit("user:disconnected", socket.id)
        }
      });
    }

  });

});


