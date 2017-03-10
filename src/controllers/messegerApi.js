var request = require('request')

module.exports = {
  sendTextMessage: function (recipientId, text) {
    _sendMessage(recipientId, { text: text })
  },
  sendWelcomeMessage: function (recipientId) {
    _sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: 'Hola soy BikeBot 🚲',
              subtitle: 'Encuentra la ecobici mas cercana conmigo',
              image_url: process.env.SERVER_URL + '/assets/images/bikibot_fondo.png',
              buttons: [
                {type: 'postback', title: 'Buscar Bici', payload: 'GET_BIKE'},
                {type: 'postback', title: 'Encontrar Espacio', payload: 'GET_SLOT'}
              ]
            }
          ]
        }
      }
    })
  },
  sendLocationReply: function (recipientId, name) {
    let qArray = [
      (name !== '' && name != null) ? `${name}, ¿Cuál es tu ubicación` : '¿Cuál es tu ubicación?',
      (name !== '' && name != null) ? `${name}, ¿Cuál es tu ubicación` :'¿Dónde estás? 📍',
      (name !== '' && name != null) ? `${name}, ¿Dónde estás? 📍` :'¿Por dónde estas?',
      (name !== '' && name != null) ? `${name}, ¿Por dónde estas?` :'¿Me conpartes tu ubicación?'
    ]
    let text = qArray[ Math.floor(Math.random() * qArray.length) ]

    _sendMessage(recipientId, {
      text: text,
      quick_replies: [{ 'content_type': 'location' }]
    })
  },
  sendShareWithFrends: function (recipientId) {
    _sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: [
            {
              title: 'Hola soy BikeBot 🚲',
              subtitle: 'Encuentra la ecobici mas cercana conmigo',
              image_url: process.env.SERVER_URL + '/assets/images/bikibot_fondo.png',
              buttons: [
                {
                  type: 'web_url',
                  url: 'https://m.me/1085397894889504',
                  title: 'Iniciar conversacion'
                }
              ]
            }
          ]
        }
      }
    })
  },
  sendTyping: function (event, enable) {
    _sendMessage(event.sender.id, null, (enable) ? 'typing_on' : 'typing_off')
  },
  sendStations: function (recipientId, locations, coords) {
    var message = {
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

    let morePayload = {
      coords: coords,
      stationsLeft: []
    }

    for (let i = 0; i < locations.length; i++) {
      if (i < 3) {
        let elementList = _createListElement(locations[i], coords)
        message.attachment.payload.elements.push(elementList)
      } else {
        morePayload.stationsLeft.push(locations[i])
      }
    }

    // Se añde el boton de 'Ver más'
    if (morePayload.stationsLeft.length >= 3) {
      message.attachment.payload.buttons.push({
        title: 'Ver más',
        type: 'postback',
        payload: JSON.stringify(morePayload)
      })
    }

    _sendMessage(recipientId, message)
  }

}

// Request For API
// =============================
function _sendMessage (recipientId, message, action) {

  let messageData = {
    recipient: {
      id: recipientId
    }
  }

  if (message != null) messageData.message = message
  if (action != null) messageData.sender_action = action

  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCES_TOKEN },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (error || response.statusCode !== 200)
      console.error('Failed calling Send API', response.statusCode, response.statusMessage, body.error)
  })
}

// Generacion de templates
// =============================
function _createListElement (station, userLoc) {
  let availabilityText = (station.bikes !== undefined) ? `${station['bikes']} 🚲` : `${station['slots']} 🏁`

  return {
    title: station.name,
    image_url: _getGoogleMapsImageUrl(station),
    subtitle: `${availabilityText} - ${parseFloat(station.distance).toFixed(1)} km`,
    default_action: {
      type: 'web_url',
      url: _getMapServiceUrl(userLoc, station) ,
      messenger_extensions: true,
      webview_height_ratio: 'tall',
      fallback_url: _getMapServiceUrl(userLoc, station)
    }
  }
}

function _getMapServiceUrl (userLoc, station) {
  return `${process.env.SERVER_URL}/map?user_lat=${userLoc[1]}&user_long=${userLoc[0]}&stat_lat=${station.lat}&stat_long=${station.long}`
}

function _getGoogleMapsImageUrl (station) {
  return `https://maps.googleapis.com/maps/api/staticmap?size=200x200&scale=2&center=${station.lat},${station.long}&zoom=16&markers=${station.lat},${station.long}`
}
