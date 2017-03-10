var mongoose = require('mongoose')
var Schema = mongoose.Schema

var User = function () {
  var UserSchema = new Schema({
    _id: { type: Number, required: true, unique: true },
    name: String,
    status: String,
    timestamp: Date
  })

  mongoose.model('User', UserSchema)
}

module.exports = User
