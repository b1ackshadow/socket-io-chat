const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
  participants: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],
  messages: [
    {
      from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      text: String,
      created_at: { type: Date, default: Date.now }
    }
  ]
});

module.exports = mongoose.model("Chat", ChatSchema);
