var async = require('async')
var mongoose = require('mongoose')
var BikeStation = mongoose.model('BikeStation')
var Ecobici = require('ecobicimx')

var ecobiciClient = new Ecobici({
  clientId: process.env.ECO_CLIENT_ID,
  clientSecret: process.env.ECO_CLIENT_SECRET
})

module.exports = {
  init: function () {
    async.auto({
      get_bikeStations: (cb) => {
        ecobiciClient.getStations('info').then((response) => {
          cb(null, response.stations)
        }).catch((err) => {
          cb(err, null)
        })
      },
      set_db: ['get_bikeStations', (results, cb) => {
        mongoose.connect(process.env.DB_URL, function (err) {
          if (err) {
            console.log('Error DB')
            throw err
          }
          BikeStation.remove(() => {
            async.each(results.get_bikeStations, function (item, cb) {
              var station = {
                ecobici_id: item.id,
                name: sanitizeName(item.name),
                address: item.address,
                type: item.stationType,
                loc: [item.location.lon, item.location.lat],
                bikes: 0,
                slots: 0
              }
              BikeStation.create(station, cb)
            }, function (err) {
              if (err) throw err
            })
          })
        })
      }]
    }, function (err, results) {
      if (err) throw err
    })
  }
}

function sanitizeName (str) {
  if (str.charAt(0) === ' ') return str.slice(1)
  if (parseInt(str.charAt(0)) != null) {
    return capitalize(sanitizeName(str.slice(1).replace('-', ' y ')).replace(' Y ', ' y '))
  }
}

function capitalize (str) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, function (a) { return a.toUpperCase() })
}
