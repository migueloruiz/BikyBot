var async = require('async')
var mongoose = require('mongoose')
var BikeStation = mongoose.model('BikeStation')
var User = mongoose.model('User')
var path = require('path')
var messagerApi = require(path.join(__dirname, 'messegerApi'))
var graphApi = require(path.join(__dirname, 'graphApi'))
var Ecobici = require('ecobicimx')

var ecobiciClient = new Ecobici({
  clientId: process.env.ECO_CLIENT_ID,
  clientSecret: process.env.ECO_CLIENT_SECRET
})

// Exports Module
// ======================
module.exports = {
  processMessage: (messageData) => {
    messageData.entry.forEach((pageEntry) => {
      // Validacion de pagina
      if (pageEntry.id !== process.env.FB_PAGE_ID) {
        console.warn(`Page ${pageEntry.id} try to send message`)
        return
      }
      // Procesamiento del mansaje
      pageEntry.messaging.forEach((messagingEvent) => {
        messagerApi.sendTyping(messagingEvent, true)
        if (messagingEvent.message) _processMessage(messagingEvent)
        if (messagingEvent.postback) _processPostback(messagingEvent)
      })
    })
  }
}

// Bissnes Logic
// ======================
function _processMessage (event) {
  let senderID = event.sender.id
  let message = event.message
  let text = message.text

  // Para cualquier texto se envia el mismo mensaje
  // Se bloquea el uso de teclado para el usuario
  if (text) messagerApi.sendWelcomeMessage(senderID)

  // Si el mensaje tiene una loaccion adjunta
  if (message.attachments) {
    let attachment = message.attachments.filter((item) => {
      return item.type === 'location'
    })
    if (attachment.length > 0){
      let coords = [	// coordinates [ <longitude> , <latitude> ]
        attachment[0].payload.coordinates.long,
        attachment[0].payload.coordinates.lat
      ]
      _getStationsForUser(senderID, coords)
    }
  }
}

function _processPostback (event) {
  let senderID = event.sender.id
  let postbackOption = event.postback.payload

  switch (postbackOption) {
    case 'START':
      messagerApi.sendWelcomeMessage(senderID)
      break
    case 'GET_SLOT':
    case 'GET_BIKE':
      _setUserRequest (senderID, postbackOption)
      break
    case 'SHARE':
      messagerApi.sendShareWithFrends(senderID)
      break
    default:
      let data = JSON.parse(postbackOption)
      messagerApi.sendStations(senderID, data.stationsLeft, data.coords)
  }
}

function _setUserRequest (senderID, postbackOption) {

  // TODO: Usar UPdate??????
  // TODO: Diferencias users
  User.find({
    _id: senderID
  }, (err, data) => {
    if (err) throw err

    if (data.length > 0) {
      data[0].status = postbackOption
      data[0].timestamp = new Date().toISOString()
      data[0].save((err) => {
        if (err) throw err
      })
    } else {
      graphApi.getUserDataByID(senderID).then((user) => {
        let userData = {
          _id: senderID,
          name: user['first_name'],
          status: postbackOption,
          timestamp: new Date().toISOString()
        }
        User.create(userData)
      }).catch((err) => {
        User.create({
          _id: senderID,
          name: '',
          status: postbackOption,
          timestamp: new Date().toISOString()
        })
      })
    }
    // TODO: Pasarle el nombre y generar repustas mas humans
    messagerApi.sendLocationReply(senderID)
  })
}

function _getStationsForUser (senderID, coords) {
  async.auto({
    getUserInfo: (cb) => {
      User.find({ sender_id: senderID }, function (err, data) {
        if (err) throw cb('No se puede encontrar al usuario', null)

        if (data.length > 0) {
          // TODO: Estatus no valido
          // TODO: Avisar de la locaciion expirada y pedir nuevamente
          let userStatus = data[0].status
          cb(null, {
            userStatus: userStatus
          })
        } else {
          cb(`Usuarion ${senderID} no encontrado`, null)
        }
      })
    },
    get_bikeStationStatus: (cb) => {
      ecobiciClient.getStations('status').then((response) => {
        cb(null, response.stationsStatus)
      }).catch((err) => {
        console.error(err)
        cb('Estoy teniendo problemas encontrado las distintas estaciones, por favor intenta mas tarde', null)
        throw err
      })
    },
    setStatusInDB: ['get_bikeStationStatus', (results, cb) => {
      results.get_bikeStationStatus.forEach((item) => {
        // TODO: que pasa si hay in ID que no existe en la base de datos
        BikeStation.update({
          ecobici_id: item.id
        }, {
          bikes: item.availability.bikes,
          slots: item.availability.slots
        }, function (err, raw) {
          if (err) console.log('error ', err)
        })
      })
      cb(null, null)
    }],
    getNearStations: ['getUserInfo', 'get_bikeStationStatus', 'setStatusInDB', (results, cb) => {
      let query = {
        loc: {
          $near: coords// ,$maxDistance: 2 //2 km 8/6371;
        }
      }

      if (results.getUserInfo.userStatus === 'GET_BIKE') { query.bikes = {$gt: 1} } else { query.slots = {$gt: 1} }

      let excluedes = {
        _id: 0,
        __v: 0,
        ecobici_id: 0,
        type: 0,
        address: 0
      }

      if (results.getUserInfo.userStatus === 'GET_BIKE') { excluedes.slots = 0 } else { excluedes.bikes = 0 }

      BikeStation.find(query, excluedes)
      .limit(9)
      .exec(function (err, locationsData) {
        if (err) cb('Lo lamento no hay estaciones cerca de tu ubicacción', null)
        if (locationsData.length > 0) {
          let mapLocations = locationsData.map((station) => {
            return mapStation(station, coords)
          })
          messagerApi.sendStations(senderID, mapLocations, coords)
          cb(null, null)
        } else {
          cb('Lo lamento no hay estaciones cerca de tu ubicacción', null)
        }
      })
    }]
  }, function (err, results) {
    if (err) messagerApi.sendTextMessage(senderID, err)

    User.update({sender_id: senderID}, {
      status: 'RESOLVED'
    }, function (error, numberAffected, rawResponse) {
      if (error) throw error
    })

  })
}

function mapStation (station, coords) {
  let tempStation = JSON.parse(JSON.stringify(station))
  tempStation.distance = getEarthDistance(station.loc, coords)
  tempStation.long = station.loc[0]
  tempStation.lat = station.loc[1]
  delete tempStation['loc']
  return tempStation
}

function getEarthDistance (a, b) {
  const R = 6378 // 6371000  metros
  let φ1 = toRad(a[1])
  let φ2 = toRad(b[1])
  let Δφ = toRad(b[1] - a[1])
  let Δλ = toRad(b[0] - a[0])

  let x = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  let y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))

  return (R * y).toFixed(3)
}

function toRad (value) {
  return value * Math.PI / 180
}
