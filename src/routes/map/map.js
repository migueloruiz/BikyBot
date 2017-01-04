var express = require('express')
var router = express.Router()

// ?user_lat=19.4406926&user_long=-99.2047001&stat_lat=19.4400959&stat_long=-99.2044638
router.get('/', function (req, res, next) {
	let user_lat = req.query.user_lat;
  let user_long = req.query.user_long;
	let stat_lat = req.query.stat_lat;
  let stat_long = req.query.stat_long;
  res.render('map',{
    apiUrl: `https://maps.googleapis.com/maps/api/js?key=${process.env.MAPS_KEY}`,
		markers: [
			{
				title: 'Tu',
				lat: user_lat,
				lng: user_long,
				icon: '/assets/images/user_marker.png'
			},{
				title: 'Estacion',
				lat: stat_lat,
				lng: stat_long,
				icon: '/assets/images/station_marker.png'
			}
		]
  })
})

module.exports = router
