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
    const { room } = data;
    socketIdToRoomMap.set(socket.id, room);
    if (room in users) {
      users[room].push(socket.id)
    } else {
      users[room] = [socket.id]
    }
    var otherUsersInThisRoom = [];
    users[room].forEach(user => {
      if (socket.id != user) {
        otherUsersInThisRoom.push(user);
        io.to(user).emit("userJoined", socket.id);
      }
    });

    io.to(socket.id).emit("otherUsersInThisRoom", { otherUsersInThisRoom });
  });

  socket.on("user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("existing:user:call", ({ to, offer }) => {
    io.to(to).emit("incomming:call:existing", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    // console.log("peer:nego:needed", to, offer)
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done", ({ to, ans }) => {
    // console.log("peer:nego:done", ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans });
  });

  socket.on("start:streaming", ({ to }) => {
    io.to(to).emit("start:streaming1");
  })
  socket.on("left:room", () => {
    console.log("left")
  })

  socket.on("disconnect", () => {
    const roomId = socketIdToRoomMap.get(socket.id);
    console.log(users)
    if (users[roomId]) {
      users[roomId] = users[roomId].filter(user => user != socket.id);
    }
    console.log(users)
    if (roomId) {
      users[roomId].forEach(user => {
        if (socket.id != user) {
          socket.to(user).emit("user:disconnected", socket.id)
        }
      });
    }

  });

});


