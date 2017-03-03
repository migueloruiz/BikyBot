var express = require('express')
var router = express.Router()

// URL Path
// ?user_lat=19.4406926&user_long=-99.2047001&stat_lat=19.4400959&stat_long=-99.2044638

router.get('/', function (req, res, next) {
  let userLat = req.query.user_lat
  let userLong = req.query.user_long
  let stationLat = req.query.stat_lat
  let stationLOng = req.query.stat_long

  res.render('map', {
    apiUrl: `https://maps.googleapis.com/maps/api/js?key=${process.env.MAPS_KEY}`,
    markers: [
      {
        title: 'Tu',
        lat: userLat,
        lng: userLong,
        icon: '/assets/images/user_marker.png'
      }, {
        title: 'Estacion',
        lat: stationLat,
        lng: stationLOng,
        icon: '/assets/images/station_marker.png'
      }
    ]
  })
})

module.exports = router
