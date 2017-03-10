var request = require('request')

module.exports = {
  sendTextMessage: function (recipientId, messageText) {
    _sendMessage({
      recipient: {
        id: recipientId
      },
      message: {
        text: messageText,
        metadata: 'DEVELOPER_DEFINED_METADATA'
      }
    })
  },
  sendWelcomeMessage: function (recipientId) {
    _sendMessage({
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
      }
    })
  },
  sendLocationReply: function (recipientId) {
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
    _sendMessage(messageData)
  },
  sendShareWithFrends: function (recipientId) {
    _sendMessage({
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
                title: 'Hola soy BikeBot 🚲',
                subtitle: 'Encuentra la ecobici mas cercana conmigo',
                image_url: process.env.SERVER_URL + '/assets/images/bikibot_fondo.png',
                buttons: [
                  // { type: 'element_share' },
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
      }
    })
  },
  sendTyping: function (event, enable) {
    var messageData = {
      recipient: {
        id: event.sender.id
      },
      sender_action: (enable) ? 'typing_on' : 'typing_off'
    }

    _sendMessage(messageData)
  },
  sendStations: function (recipientId, locations, coords) {
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
        let elementList = _createListElement(stationFiltered[i], coords)
        messageData.message.attachment.payload.elements.push(elementList)
      } else {
        morePayload.stationsLeft.push(stationFiltered[i])
      }
    }

    moreButton.payload = JSON.stringify(morePayload)

    if (morePayload.stationsLeft.length >= 3) {
      messageData.message.attachment.payload.buttons.push(moreButton)
    }

    _sendMessage(messageData)
  }

}



function _createListElement (station, userLoc) {
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


// Request For API
// =============================
function _sendMessage (messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCES_TOKEN },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var recipientId = body.recipient_id
      var messageId = body.message_id
      // if (messageId) {
      //   console.log('Successfully sent message with id %s to recipient %s',
      //   messageId, recipientId)
      // } else {
      //   console.log('Successfully called Send API for recipient %s',
      //   recipientId)
      // }
    } else {
      // TODO: MANEJAR errores de API
      console.error('Failed calling Send API', response.statusCode, response.statusMessage, body.error)
    }
  })
}
