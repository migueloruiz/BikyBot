
var async = require('async')
var mongoose = require('mongoose')
var BikeStation = mongoose.model('BikeStation')
var User = mongoose.model('User')
var path = require('path')
var messagerApi = require(path.join(__dirname, 'messegerApi'))
var Ecobici = require('ecobicimx')

var ecobiciClient = new Ecobici({
  clientId: process.env.ECO_CLIENT_ID,
  clientSecret: process.env.ECO_CLIENT_SECRET
})

module.exports = {
  processMessage: function (messageData) {
    messageData.entry.forEach(function (pageEntry) {
      pageEntry.messaging.forEach(function (messagingEvent) {
        // TODO: Revisar que coincida con la pagina
        console.log('messagingEvent', messagingEvent)
        sendTyping(messagingEvent, true)
        if (messagingEvent.message) receivedMessage(messagingEvent)
        if (messagingEvent.postback) receivedPostback(messagingEvent)
      })
    })
  }
}

function receivedMessage (event) {
  let senderID = event.sender.id
  let message = event.message
  let text = message.text
  if (text) {
    switch (text) {
      case 'hola':
      case 'Hola':
        sendWelcomeMessage(senderID)
        return
      case 'gracias':
      case 'Gracias':
      case 'grax':
        sendGraitudeMessage(senderID)
        return
      default:
        // TODO: guardar todas las palablas no conocidas
        sendApologizeMessage(senderID)
        return
    }
  }

  if (message.attachments) {
    let attachment = message.attachments.filter((item) => {
      return item.type === 'location'
    })

    if (attachment.length > 0) {
      User.find({ sender_id: senderID }, function (err, data) {
        if (err) throw err

        if (data.length > 0) {
          let userStatus = data[0].status

          // coordinates [ <longitude> , <latitude> ]
          let coords = []
          coords[0] = attachment[0].payload.coordinates.long
          coords[1] = attachment[0].payload.coordinates.lat

          async.auto({
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
            getNearStations: ['get_bikeStationStatus', 'setStatusInDB', (results, cb) => {
              let query = {
                loc: {
                  $near: coords// ,$maxDistance: 2 //2 km 8/6371;
                }
              }

              if (userStatus === 'GET_BIKE') { query.bikes = {$gt: 1} } else { query.slots = {$gt: 1} }

              let excluedes = {
                _id: 0,
                __v: 0,
                ecobici_id: 0,
                type: 0,
                address: 0
              }

              if (userStatus === 'GET_BIKE') { excluedes.slots = 0 } else { excluedes.bikes = 0 }

              BikeStation.find(query, excluedes)
              .limit(9)
              .exec(function (err, locationsData) {
                if (err) cb('Lo lamento no hay estaciones cerca de tu ubicacción', null)
                if (locationsData.length > 0) {
                  let mapLocations = locationsData.map((station) => {
                    return mapStation(station, coords)
                  })
                  sendStations(senderID, mapLocations, coords)
                } else {
                  cb('Lo lamento no hay estaciones cerca de tu ubicacción', null)
                }
              })
            }]
          }, function (err, results) {
            if (err) sendTextMessage(senderID, err)
            User.remove(function (err) {
              if (err) throw err
            })
            User.update({sender_id: senderID}, {
              status: 'RESOLVED'
            }, function (err, numberAffected, rawResponse) {
              console.error('Error', err)
            })
          })
        }
      })
    }
  }
}

function receivedPostback (event) {
  var senderID = event.sender.id
  var payload = event.postback.payload
  var timestamp = event.timestamp

  switch (payload) {
    case 'START':
      sendWelcomeMessage(senderID)
      break
    case 'GET_SLOT':
    case 'GET_BIKE':
      User.find({ sender_id: senderID }, function (err, data) {
        if (err) throw err
        if (data.length > 0) {
          data[0].status = payload
          data[0].save((err) => {
            if (err) throw err
          })
        } else {
          let userItem = {
            sender_id: senderID,
            status: payload,
            timestamp: timestamp
          }
          User.create(userItem)
        }
        sendLocationReply(senderID)
      })
      break
    default:
      sendMoreStations(payload, senderID)
  }
}

// TODO: momer esto a UI
function sendTextMessage (recipientId, messageText) {
  messagerApi.sendMessage({
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: 'DEVELOPER_DEFINED_METADATA'
    }
  })
}

// TODO: momer esto a UI
function sendWelcomeMessage (recipientId) {
  messagerApi.sendMessage({
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: '¡Hola!, ¿En qué podemos ayudarte?',
              subtitle: 'Te ayudo en tu recorrido diario.',
              image_url: 'https://baconmockup.com/300/200',
              buttons: [
                {type: 'postback', title: 'Buscar Bici', payload: 'GET_BIKE'},
                {type: 'postback', title: 'Encontrar Espacio', payload: 'GET_SLOT'}
              ]
            }
          ]
        }
      }
    }
  })
}

// TODO: momer esto a UI
function sendGraitudeMessage (recipientId) {
  var gratitude = ['Es un gusto ayudarte 😄', 'Puedes compartirme con un amigo con este link https://goo.gl/r7WMVl', 'Esta es mi  página https://www.facebook.com/ecobotMX/']
  sendTextMessage(recipientId, gratitude[Math.floor(Math.random() * gratitude.length)])
}

// TODO: momer esto a UI
function sendApologizeMessage (recipientId) {
  messagerApi.sendMessage({
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: '¡Aún no soy tan listo! 😅',
              subtitle: 'Por el momento te puedo ayudar con estas tareas 💪',
              image_url: 'https://baconmockup.com/300/200',
              buttons: [
                {type: 'postback', title: 'Encontrar 🚲', payload: 'GET_BIKE'},
                {type: 'postback', title: 'Encontrar 🅿️', payload: 'GET_SLOT'}
              ]
            }
          ]
        }
      }
    }
  })
}

// TODO: momer esto a UI
function sendLocationReply (recipientId) {
  let qArray = ['¿Cuál es tu ubicación?', '¿Dónde estás? 📍', '¿Por dónde estas?', '¿Me conpartes tu ubicación?']
  let text = qArray[ Math.floor(Math.random() * qArray.length) ]

  let messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text,
      quick_replies: [{ 'content_type': 'location' }]
    }
  }

  messagerApi.sendMessage(messageData)
}

// TODO: momer esto a UI
function sendTyping (event, enable) {
  var messageData = {
    recipient: {
      id: event.sender.id
    },
    sender_action: (enable) ? 'typing_on' : 'typing_off'
  }

  messagerApi.sendMessage(messageData)
}

// TODO: momer esto a UI
function sendStations (recipientId, locations, coords) {
  let stationFiltered = locations.sort(function (a, b) {
    return a.distance - b.distance
  })

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'list',
          top_element_style: 'large',
          elements: [
            {
              title: 'Estaciones más cercanas',
              image_url: process.env.SERVER_URL + '/assets/images/fondo.jpg',
              subtitle: 'Aquí hay lugares disponibles'
            }
          ],
          buttons: []
        }
      }
    }
  }

  let morePayload = {
    coords: coords,
    stationsLeft: []
  }

  let moreButton = {
    title: 'Ver más',
    type: 'postback',
    payload: ''
  }

  for (let i = 0; i < stationFiltered.length; i++) {
    if (i < 3) {
      let elementList = createListElement(stationFiltered[i], coords)
      messageData.message.attachment.payload.elements.push(elementList)
    } else {
      morePayload.stationsLeft.push(stationFiltered[i])
    }
  }

  moreButton.payload = JSON.stringify(morePayload)

  if (morePayload.stationsLeft.length >= 3) {
    messageData.message.attachment.payload.buttons.push(moreButton)
  }

  messagerApi.sendMessage(messageData)
}

// TODO: momer esto a UI
function sendMoreStations (payload, recipientId) {
  let data = JSON.parse(payload)
  sendStations(recipientId, data.stationsLeft, data.coords)
}

// TODO: momer esto a UI
function createListElement (station, userLoc) {
  let availabilityText = (station.bikes !== undefined) ? `${station['bikes']} 🚲` : `${station['slots']} 🏁`
  let distanceText = `${availabilityText} - ${parseFloat(station.distance).toFixed(1)} km`
  let mapUrl = `${process.env.SERVER_URL}/map?user_lat=${userLoc[1]}&user_long=${userLoc[0]}&stat_lat=${station.lat}&stat_long=${station.long}`
  let imageMap = `https://maps.googleapis.com/maps/api/staticmap?size=200x200&scale=2&center=${station.lat},${station.long}&zoom=16&markers=${station.lat},${station.long}`
  return {
    title: station.name,
    image_url: imageMap,
    subtitle: distanceText,
    default_action: {
      type: 'web_url',
      url: mapUrl,
      messenger_extensions: true,
      webview_height_ratio: 'tall',
      fallback_url: mapUrl
    }
  }
}

function mapStation (station, coords) {
  let tempStation = cloneObjet(station)
  tempStation.distance = distance(station.loc, coords)
  tempStation.long = station.loc[0]
  tempStation.lat = station.loc[1]
  delete tempStation['loc']
  return tempStation
}

function distance (a, b) {
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

function cloneObjet (obj) {
  return JSON.parse(JSON.stringify(obj))
}
