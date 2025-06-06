const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    documento: { type: String, required: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    grade: { type: String, required: true },
    age: { type: Number, required: true },
    tag: { type: String, required: true }
  });
  

module.exports = mongoose.model("Users", userSchema)