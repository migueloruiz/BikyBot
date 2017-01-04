// Dependences
// ==========================
var express = require('express')
var path = require('path')
var http = require('http')
var request = require('request');
var async = require('async')

// Midlleware
// ==========================
var favicon = require('serve-favicon')
var compression = require('compression')
var bodyParser = require('body-parser')

// Databease
// ==========================
var mongoose = require('mongoose')
mongoose.Promise = require('bluebird')

// Models
// ==========================
var bikeStationModel = require(path.join(__dirname, 'src/models/bikeStation'))()
var UserModel = require(path.join(__dirname, 'src/models/user'))()
var BikeStation = mongoose.model('BikeStation')

// Routes
// ==========================
var index = require(path.join(__dirname, 'src/routes/index/index'))
var webhook = require(path.join(__dirname, 'src/routes/webhook/webhook'))

// Dev Dependences
// ==========================
console.log(`================= ${process.env.NODE_ENV} mode =================`)
if( process.env.NODE_ENV !== 'production' ){
	var dotenv = require('dotenv')
	dotenv.load()
}

const DB_USER = process.env.DB_USER
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_URL = process.env.DB_URL

const ECO_ID = process.env.ECO_CLIENT_ID
const ECO_SECRET = process.env.ECO_CLIENT_SECRET

// Databease Setup
// ==========================
async.auto({
  get_ecobici_access: (cb) =>{
		var url = `https://pubsbapi.smartbike.com/oauth/v2/token?client_id=${ECO_ID}&client_secret=${ECO_SECRET}&grant_type=client_credentials`
		request(url, function (err, response, body) {
			if (err) throw err
			if (!err && response.statusCode == 200) {
				var data = JSON.parse(body);
				cb(null, data.access_token);
			}
		})
  },
	get_bikeStations: ['get_ecobici_access', (results, cb) => {

		var url = `https://pubsbapi.smartbike.com/api/v1/stations.json?access_token=${results.get_ecobici_access}`
		request(url, function (err, response, body) {
			if (err) throw err
			if (!err && response.statusCode == 200) {
				var data = JSON.parse(body);
				cb(null, data.stations);
			}
		})
	}],
	set_db: ['get_ecobici_access','get_bikeStations', (results, cb) => {
		mongoose.connect(`mongodb://${DB_USER}:${DB_PASSWORD}@${DB_URL}`, function (err) {
		  if (err) {
				console.log('Error DB')
				throw err
			}

		  BikeStation.remove(function() {
		    async.each(results.get_bikeStations, function(item, cb) {
					var station = {
						ecobici_id: item.id,
						name: item.name,
						address: item.address,
						type: item.stationType,
						loc: [item.location.lon, item.location.lat]
					}
		      BikeStation.create(station, cb)
		    }, function(err) {
		      if (err) throw err
		    })
		  })
		})

	}]
}, function(err, results) {
		if(err)
			throw err
    console.log('Server Init');
});

// Server Setup
// ==========================

const APP_SECRET = process.env.FB_APP_SECRET
const VALIDATION_TOKEN = process.env.VALIDATION_TOKEN
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCES_TOKEN
const SERVER_URL = process.env.SERVER_URL

var app = express()

if (!(APP_SECRET && VALIDATION_TOKEN && PAGE_ACCESS_TOKEN && SERVER_URL)) {
  console.error('Missing config values')
  process.exit(1)
} else {
  console.log(APP_SECRET)
  app.set('APP_SECRET', APP_SECRET)
  app.set('VALIDATION_TOKEN', VALIDATION_TOKEN)
  app.set('PAGE_ACCESS_TOKEN', PAGE_ACCESS_TOKEN)
  app.set('SERVER_URL', SERVER_URL)
}

var port = process.env.PORT || 4000
app.set('port', port)

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(favicon(path.join(__dirname, 'src/public', 'favicon.ico')))
app.use(compression())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))

var server = http.createServer(app)
server.on('error', onError)
server.on('listening', onListening)

// Routes Setup
// ==========================
app.use('/', index)
app.use('/webhook', webhook)

// Event listener for HTTP server "error" event.
// ==========================
function onError (error) {
  console.log(error)
  if (error.syscall !== 'listen') throw error

  var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      break
    default:
      throw error
  }
}

// Event listener for HTTP server "listening" event.
// ==========================
function onListening () {
  var addr = server.address()
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port
  console.error('Listening on ' + bind)
  // debug('Listening on ' + bind)
}

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message
  res.locals.error = req.app.get('env') === 'development' ? err : {}

  // render the error page
  res.status(err.status || 500)
  res.render('error')
})

// Start Listen Serve
// ==========================
app.listen(app.get('port'), function () {
  console.log( process.env.PROJECT + ' on port', app.get('port'))
})
module.exports = app
