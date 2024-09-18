// db.js
require('dotenv').config()
const mongoose = require('mongoose');




mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Define schemas
const roomSchema = new mongoose.Schema({
  roomId: String,
  createdAt: { type: Date, default: Date.now },
  endedAt: Date,
  userCount: { type: Number, default: 0 },
  callSuccessful: { type: Boolean, default: false },
});

const userSchema = new mongoose.Schema({
  userId: String,
  socketId: String,
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date,
  roomId: String,
});

const statsSchema = new mongoose.Schema({
  totalRooms: { type: Number, default: 0 },
  totalUsers: { type: Number, default: 0 },
  successfulCalls: { type: Number, default: 0 },
  droppedCalls: { type: Number, default: 0 },
  peakConcurrentUsers: { type: Number, default: 0 },
  mostPopularRoom: String,
});

// Create models
const Room = mongoose.model('Room', roomSchema);
const User = mongoose.model('User', userSchema);
const Stats = mongoose.model('Stats', statsSchema);

module.exports = { Room, User, Stats };