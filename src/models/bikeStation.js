var mongoose = require('mongoose')
var Schema = mongoose.Schema

var BikeStation = function () {
  var BikeStationSchema = new Schema({
    ecobici_id: Number,
    name: String,
    address: String,
    type: String,
    loc: {
      type: [Number],   // <longitude> , <latitude> ]
      index: '2d'       // geospatial index
    }
  })

  mongoose.model('BikeStation', BikeStationSchema)
}

module.exports = BikeStation
