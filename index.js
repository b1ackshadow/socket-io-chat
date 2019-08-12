const express = require("express");
const app = express();
const path = require("path");
const passport = require("passport");
const User = require("./User");
const Chat = require("./Chat");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const bodyParser = require("body-parser");
const routes = require("./routes");
const cors = require("cors");
const morgan = require("morgan");
const http = require("http").createServer(app);
const io = require("socket.io").listen(http);

mongoose.connect(process.env.DATABASE || "mongodb://localhost/chat", {
  useNewUrlParser: true
});
mongoose.Promise = global.Promise; // Tell Mongoose to use ES6 promises
mongoose.connection.on("error", err => {
  console.error(`🙅 🚫 🙅 🚫 🙅 🚫 🙅 🚫 → ${err.message}`);
});

app.use(cors());
// allow - cors;
// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With, Content-Type, Accept"
//   );
//   // let d = new Date();
//   // let h = d.getHours();
//   // let m = d.getMinutes();
//   // let s = d.getSeconds();
//   // console.log(h + ":" + m + ":" + s);

//   // if (h === 0 && m === 0) eraseDB();

//   // next();
// });

app.set("view engine", "ejs");
app.use(morgan("dev"));
app.use(express.static("./public"));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SECRET || "change is the only constant",
    // key: process.env.KEY,
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
      mongooseConnection: mongoose.connection
    })
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/test", (req, res) => {
  res.json({ data: "hey" });
});

app.post("/login", routes.login, (req, res) => {
  req.session.cookie.maxAge = 5 * 60 * 1000;
  res.redirect("/home");
  // res.json(req.user);
});

app.use((req, res, next) => {
  // console.log(req);

  //5m is the max age keeps resetting
  req.session.cookie.maxAge = 5 * 60 * 1000;
  res.locals.user = req.user || null;
  next();
});

// db.chats.aggregate([
//   {
//     $match: {
//       participants: {
//         $all: [
//           ObjectId("5d46ca7e2d56c143e7faef5e"),
//           ObjectId("5d470210ce2fb8757f005eb4")
//         ]
//       }
//     }
//   },
//   {
//     $unwind: "$messages"
//   },
//   {
//     $sort: { created_at: -1 }
//   }
// ]);

// db.chats.find({
//   participants: {
//     $all: [
//       ObjectId("5d46ca7e2d56c143e7faef5e"),
//       ObjectId("5d470210ce2fb8757f005eb4")
//     ]
//   }
// });
//chat apis
app.get(
  "/chat_history/:from_id/:to_id",
  routes.isLoggedIn,
  async (req, res) => {
    try {
      let participants = Object.values(req.params);
      participants = participants.map(
        each => new mongoose.Types.ObjectId(each.replace(/["']/g, ""))
      );
      let messages = await Chat.aggregate([
        {
          $match: { participants: { $all: participants } }
        },

        // {
        //   $project: { messages: 1 }
        // },
        {
          $unwind: "$messages"
        },
        {
          $sort: {
            "messages.created_at": -1
          }
        },
        {
          $limit: 10
        },
        {
          $sort: {
            "messages.created_at": 1
          }
        }
      ]);

      res.send(messages);
    } catch (error) {
      console.log(error);
    }
  }
);

app.get("/logout", routes.logout);

app.post("/register", routes.register, routes.login);

app.get("/home", routes.isLoggedIn, async (req, res) => {
  // try {
  //   let arr = new Chat({
  //     room_name: new mongoose.Types.ObjectId(),
  //     participants: [
  //       mongoose.Types.ObjectId("5d46ca7e2d56c143e7faef5e"),
  //       mongoose.Types.ObjectId("5d470210ce2fb8757f005eb4")
  //     ]
  //   });
  //   let chat = await arr.save();
  //   // console.log(friends);
  // } catch (e) {
  //   console.log(e);
  // }
  // try {
  //   let friends = [mongoose.Types.ObjectId("5d470210ce2fb8757f005eb4")];
  //   let res = await User.findByIdAndUpdate(req.user._id, { friends });
  //   friends = [mongoose.Types.ObjectId("5d46ca7e2d56c143e7faef5e")];
  //   res = await User.findByIdAndUpdate(
  //     mongoose.Types.ObjectId("5d470210ce2fb8757f005eb4"),
  //     { friends }
  //   );
  // } catch (error) {
  //   console.log(error);
  // }
  // let friend = [
  //   { name: "d", id: mongoose.Types.ObjectId("5d470210ce2fb8757f005eb4") }
  // ];
  res.render("home", { friends: [] });
  // res.send("d");
});

app.get("/chat/:id", (req, res) => {
  // res.send(req.params.id);
});

http.listen(5000, () => {
  console.log(`Server running on 5000`);
});

const users = {};
const getId = {};
io.on("connection", function(socket) {
  console.log(`${socket.id} connected`);
  users[socket.id] = mongoose.Types.ObjectId();

  socket.on("disconnect", function() {
    try {
      let active = users[socket.id].active;
      // console.log(active);

      if (active.length < 1) return;

      for (let each of active) {
        let index = users[each].active.indexOf(socket.id);

        if (index !== -1) {
          users[each].active.splice(index, 1);

          io.to(each).emit("friendsList", users[each].active);
        }
      }

      delete users[socket.id];
    } catch (e) {}

    // console.log(users);
  });

  socket.on("msg", async data => {
    io.to(data.to).emit("msg", data);
    //insert to DB
    try {
      let from = users[data.from]._id;
      let to = users[data.to]._id;
      //check if chat exists
      let chat = await Chat.findOne({ participants: { $all: [from, to] } });

      if (!chat) {
        //create a chat
        char = new Chat({
          from,
          to
        });
        await res.save();
      }

      let insert = {
        from,
        text: data.msg
      };
      chat.messages.push(insert);
      chat.save();
    } catch (error) {
      console.log(error);
    }
  });
  socket.on("addUser", async data => {
    // socket.name = JSON.parse(data).username;
    try {
      let obj = {
        _id: JSON.parse(data)._id,
        name: JSON.parse(data).username,
        active: []
      };
      getId[obj._id] = socket.id;
      socket._id = JSON.parse(data)._id;
      let user = await User.findById(socket._id);
      users[socket.id] = obj;

      for (let friend of user.friends) {
        if (users[getId[friend]]) {
          //add friend to active users list
          users[socket.id].active.push(getId[friend]);

          // notify the friend abt current user

          users[getId[friend]].active.push(socket.id);
          // console.log(users[getId[friend]], friend);
          let friendsList = getFriendsList(users[getId[friend]]["active"]);

          io.to(getId[friend]).emit("friendsList", friendsList);
        }
      }

      let friendsList = getFriendsList(users[socket.id]["active"]);
      socket.emit("friendsList", friendsList);
    } catch (error) {
      console.log(error);
    }
  });
  const getFriendsList = list => {
    return list.map(each => {
      return {
        _id: users[each]._id,
        name: users[each].name,
        id: each
      };
    });
  };
  // socket.on("", function(data) {
  //   var new_room = ("" + Math.random()).substring(2, 7);
  //   rooms.push(new_room);
  //   data.roomCode = new_room;
  //   data.msg = "New room created, invite frndz using this ID:" + new_room;
  //   socket.emit("update-chat", data);
  //   socket.emit("room-created", data);
  // });
});
