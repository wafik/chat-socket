const mongoose = require("mongoose");

const { v4: uuidv4 } = require("uuid");
const userSchema = new mongoose.Schema({
  userId: { type: String, default: uuidv4, unique: true }, // Menambahkan userId
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String },
  name: { type: String },
});

module.exports = mongoose.model("User", userSchema);
