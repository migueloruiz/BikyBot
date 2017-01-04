var mongoose = require('mongoose')
var Schema = mongoose.Schema

var User = function () {
	var UserSchema = new Schema({
	  sender_id: { type: Number, required: true, unique: true },
		status: String,
		timestamp: Date
	})

  mongoose.model('User', UserSchema)
}

module.exports = User
