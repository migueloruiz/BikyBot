var mongoose = require('mongoose')
var Schema = mongoose.Schema

var UserDev = function () {
  var UserDevSchema = new Schema({
    _id: { type: Number, required: true, unique: true },
    name: String,
    status: String,
    timestamp: Date
  })

  mongoose.model('UserDev', UserDevSchema)
}

module.exports = UserDev
