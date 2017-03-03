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
    },
    bikes: Number,
    slots: Number
  })

  mongoose.model('BikeStation', BikeStationSchema)
}

module.exports = BikeStation

// var UserSchema = new Schema({
//   location: { 'type': {type: String, enum: "Point", default: "Point"}, coordinates: { type: [Number],   default: [0,0]} },
// });

// UserSchema.index({location: '2dsphere'});
// db.stores.find({ loc:{ $near: { $geometry: { type: "Point", coordinates: [-130, 39]}, $maxDistance:1000000 } } })
