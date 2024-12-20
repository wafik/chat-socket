const express = require("express");
const { Server } = require("socket.io");
const http = require("http");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const Queue = require("bull");
const { v4: uuidv4 } = require("uuid");
const session = require("express-session");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
require("dotenv").config();
const app = express();
const server = http.createServer(app);
const io = new Server(server);
// Impor fungsi _filterBadWord dari file filter-bad-word.js
require("./utils/filter-bad-word.js");
const redis = new Redis();
const messageQueue = new Queue("messageQueue", {
  redis: { port: 6379, host: "127.0.0.1" },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Konfigurasi session
app.use(
  session({
    secret: "xxxdddddcccc", // Ganti dengan kunci rahasia yang lebih kuat
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set ke true jika menggunakan HTTPS
  })
);

// Serve static files
app.use(express.static("public"));
// Set EJS sebagai template engine
app.set("view engine", "ejs");

// Contoh parameter yang akan dikirim ke tampilan
const host = process.env.HOST_SOCKET;
// Middleware untuk memeriksa apakah pengguna sudah login
const auth = (req, res, next) => {
  if (req.session.userId) {
    next(); // Jika sudah login, lanjutkan ke rute berikutnya
  } else {
    res.redirect("/login"); // Jika belum login, redirect ke halaman login
  }
};

// Rute /cek
app.get("/", (req, res) => {
  // Render file login.ejs dengan host
  res.render("login", { host: host });
});
app.get("/active_user", auth, (req, res) => {
  // Render file login.ejs dengan host
  res.render("active_user", { host: host, username: req.session.username });
});
app.get("/dashboard", auth, async (req, res) => {
  try {
    const users = await User.find({}); // Ambil semua pengguna, hanya ambil field username
    res.render("dashboard", {
      host: host,
      username: req.session.username,
      users,
    }); // Kirim daftar pengguna ke view
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});
app.get("/chat", auth, (req, res) => {
  // Render file login.ejs dengan host
  res.render("chat", { host: host, username: req.session.username });
});
// Routes untuk tampilan
app.get("/login", (req, res) => {
  res.render("login", { host: host });
});
// Rute untuk logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/dashboard");
    }
    res.redirect("/login"); // Redirect ke halaman login setelah logout
  });
});
app.get("/register", (req, res) => {
  res.render("register");
});
// Registration route
app.post("/register", async (req, res) => {
  const { username, password, name, email } = req.body;
  // Check if user already exists
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res
      .status(400)
      .render("register", { message: "User already exists" }); // Tampilkan pesan jika pengguna sudah ada
  }
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);
  // Create new user
  const user = new User({ username, password: hashedPassword, name, email });
  await user.save();
  // Redirect ke halaman login setelah registrasi berhasil
  res.redirect("/login");
  // res.status(201).json({ message: "User registered successfully" });
});

// Rute untuk login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) {
    return res.render("login", { message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.render("login", { message: "Invalid credentials" });
  }

  // Simpan informasi pengguna di session
  req.session.userId = user.userId;
  req.session.username = user.username;

  // Redirect ke halaman dashboard setelah login berhasil
  res.redirect("/dashboard");
});

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  auth: {
    username: process.env.MONGODB_USERNAME,
    password: process.env.MONGODB_PASSWORD,
  },
  authSource: "admin", // Jika Anda menggunakan database admin untuk otentikasi
};

mongoose
  .connect(
    `mongodb://${process.env.MONGODB_HOST}:${process.env.MONGODB_PORT}/${process.env.MONGODB_DATABASE}`,
    options
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));
const MessageSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  sender: String,
  receiver: String,
  message: String,
  timestamp: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", MessageSchema);
const activeUsers = new Set();
io.on("connection", (socket) => {
  socket.on("setUsername", (username) => {
    if (username) {
      socket.username = username;
      activeUsers.add(username);
      io.emit("activeUsers", Array.from(activeUsers));
    }
  });
  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, message } = data;

      // Validasi input
      if (!sender || !receiver || !message) {
        console.error("Invalid message data:", data);
        return;
      }
      let filterMessage = _filterBadWord(message, "***");
      console.log("cek");
      console.log(typeof filterMessage);
      const messageId = uuidv4();
      const chatMessage = JSON.stringify({
        messageId,
        sender,
        receiver,
        message: filterMessage,
        timestamp: new Date().toISOString(),
      });

      console.log("Saving to Redis:", chatMessage);

      // Simpan pesan ke Redis
      await redis.lpush("chat:messages", chatMessage);
      console.log("Message saved to Redis successfully");

      // Tambahkan job untuk memproses pesan ini
      await messageQueue.add({ task: "process_messages" }, { delay: 5000 });

      // Emit pesan baru ke semua klien
      io.emit("newMessage", {
        messageId,
        sender,
        receiver,
        message: filterMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error handling sendMessage:", error);
    }
  });

  socket.on("deleteMessage", async ({ messageId }) => {
    const messages = await redis.lrange("chat:messages", 0, -1);

    for (const msg of messages) {
      const parsedMsg = JSON.parse(msg);
      if (parsedMsg.messageId === messageId) {
        await redis.lrem("chat:messages", 1, msg);
        io.emit("messageDeleted", { messageId });
        break;
      }
    }

    await Message.deleteOne({ messageId });
    io.emit("messageDeleted", { messageId });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      activeUsers.delete(socket.username);
      io.emit("activeUsers", Array.from(activeUsers));
    }
  });
  // Kirim daftar pengguna aktif saat koneksi pertama kali dibuat
  socket.emit("activeUsers", Array.from(activeUsers));
});

const processMessages = async () => {
  console.log("Processing messages...");
  const messages = await redis.lrange("chat:messages", 0, -1);

  for (const msg of messages) {
    const parsedMsg = JSON.parse(msg);

    // Tandai pesan sebagai sedang diproses
    const isProcessing = await redis.hexists(
      "processing:messages",
      parsedMsg.messageId
    );
    if (isProcessing) continue;

    await redis.hset("processing:messages", parsedMsg.messageId, "processing");

    try {
      // Simpan ke database
      await Message.create({
        messageId: parsedMsg.messageId,
        sender: parsedMsg.sender,
        receiver: parsedMsg.receiver,
        message: parsedMsg.message,
        timestamp: parsedMsg.timestamp,
      });

      // Hapus dari Redis jika berhasil
      await redis.lrem("chat:messages", 1, msg);
    } catch (error) {
      console.error("Failed to process message:", error);
    } finally {
      // Hapus tanda pemrosesan
      await redis.hdel("processing:messages", parsedMsg.messageId);
    }
  }
};

// Tambahkan job dengan pengulangan
// messageQueue.add(
//   { task: "process_messages" },
//   {delay: 7000}
// //   { repeat: { every: 5000 } }
// );

// Proses job di queue
messageQueue.process(async (job) => {
  console.log("Job executed at:", new Date().toISOString());
  console.log("Job data:", job.data);
  console.log("Job data:", job.data?.task);

  //   if (job.data.task === "process_messages") {
  // if(job.data)
  await processMessages();
  //   }
});

app.get("/chat/recent", async (req, res) => {
  const recentMessages = await redis.lrange("chat:messages", 0, -1);

  const formattedMessages = recentMessages.map((msg) => JSON.parse(msg));
  res.json(formattedMessages);
});

app.get("/chat/history", async (req, res) => {
  // Mengambil pesan terbaru dari Redis
  const recentMessages = await redis.lrange("chat:messages", 0, -1);
  const formattedRecentMessages = recentMessages.map((msg) => JSON.parse(msg));

  // Mengambil parameter sender dan receiver dari query
  const { sender, receiver } = req.query;

  // Mengambil riwayat pesan dari database
  const historyMessages = await Message.find({
    $or: [
      { sender: sender, receiver: receiver },
      { sender: receiver, receiver: sender },
    ],
  }).sort({ timestamp: 1 });

  // Menggabungkan pesan terbaru dan riwayat pesan
  const combinedMessages = [...formattedRecentMessages, ...historyMessages];

  // Mengurutkan pesan gabungan berdasarkan timestamp
  combinedMessages.sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Mengirimkan respons
  res.json(combinedMessages);
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
