var mongoose = require('mongoose')
var Schema = mongoose.Schema

var BikeStation = function () {
  var BikeStationSchema = new Schema({
    _id: { type: Number, required: true, unique: true },
    name: String,
    address: String,
    type: String,
    loc: {
      type: [Number],   // <longitude> , <latitude> ]
      index: '2d'       // geospatial index
    },
    bikes: Number,
    slots: Number
  })

  mongoose.model('BikeStation', BikeStationSchema)
}

module.exports = BikeStation
