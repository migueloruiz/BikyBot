var async = require('async');
var mongoose = require('mongoose');
var BikeStation = mongoose.model('BikeStation');
var User = mongoose.model('User')
var path = require('path')
var messagerApi = require(path.join(__dirname, 'messegerApi'))
var request = require('request');

module.exports = {
	processMessage: function ( messageData ) {
		messageData.entry.forEach(function(pageEntry) {
			pageEntry.messaging.forEach(function(messagingEvent) {

				// Revisar que coincida con mi pagina
				console.log('messagingEvent', messagingEvent )

				// Buscar usuario y estado
				// Crear usuario

				sendTyping(messagingEvent, true)

				if (messagingEvent.message) receivedMessage(messagingEvent);
				if (messagingEvent.postback) receivedPostback(messagingEvent);

			});
		});
	}
}

function receivedMessage(event) {
  let senderID = event.sender.id;
  let message = event.message;
	let text = message.text

  if (text) {
    switch (text) {
			case 'hola':
			case 'Hola':
				sendWelcomeMessage(senderID);
				return;
			case 'gracias':
			case 'Gracias':
			case 'grax':
				sendGraitudeMessage(senderID);
				return;
      default:
				// guardar todas las palablas no conocidas
        sendApologizeMessage(senderID);
				return;
    }
  }

	if(message.attachments)
		receivedAttachment(senderID, message.attachments);

}

function receivedAttachment( senderID, attachments ){

		let userLocation = getUserLocation( attachments );

		if( userLocation == null ) return;

		// MODER BUSQUEDA DE USUSRIO PARA OTRO LADO
		// MODER BUSQUEDA DE USUSRIO PARA OTRO LADO
		// MODER BUSQUEDA DE USUSRIO PARA OTRO LADO
		// MODER BUSQUEDA DE USUSRIO PARA OTRO LADO

		User.find({ sender_id: senderID }, function(err, data) {
			if (err) throw err;

			if( data.length > 0 ){
				let userStatus = data[0].status;

				async.auto({
					getNearStations: (cb) => {
						// var maxDistance = 2 //2 km   8/6371;

						BikeStation.find({
							loc: {
								$near: userLocation,
								// $maxDistance: maxDistance
							}
						}).limit(10).exec(function(err, locationsData) {
							if (err){
								console.log(err);
								return;
							}
							if(locationsData.length > 0){
								cb(null, locationsData);
							}else{
								sendTextMessage(senderID, 'Lo lamento no hay estaciones cerca de tu ubicación');
								cb('Lo lamento no hay estaciones cerca de tu ubicacción', null);
							}
						})
					},
					get_ecobici_access: (cb) =>{
						let url = `https://pubsbapi.smartbike.com/oauth/v2/token?client_id=${process.env.ECO_CLIENT_ID}&client_secret=${process.env.ECO_CLIENT_SECRET}&grant_type=client_credentials`
						request(url, function (err, response, body) {
							if (err) throw err
							cb(null, JSON.parse(body).access_token);
						})
					},
					get_bikeStationStatus: ['get_ecobici_access', (results, cb) => {

						let url = `https://pubsbapi.smartbike.com/api/v1/stations/status.json?access_token=${results.get_ecobici_access}`
						request(url, function (err, response, body) {
							if (err) throw err
							cb(null, JSON.parse(body).stationsStatus);
						})
					}],
					filterStatios: ['get_bikeStationStatus','getNearStations', (results, cb) => {

						let stationFiltered = [];
						for (let i = 0; i < results.get_bikeStationStatus.length; i++) {
							for (let j = 0; j < results.getNearStations.length; j++) {
								if(results.getNearStations[j].ecobici_id == results.get_bikeStationStatus[i].id){

									let item = cleanStation( results.getNearStations[j], results.get_bikeStationStatus[i].availability , userLocation, userStatus )

									// cleanStation gregresa objetos null si no satisfacen el status del usuario
									if(item != null) stationFiltered.push(item)

									// se eliminan del arrego aquellos elemnetos ya encontrados para reducir tiempo en el siguiente loop
									let index = results.getNearStations.indexOf(results.getNearStations[j])
									if (index > -1) results.getNearStations.splice(index, 1)

									// se forza a terminar el ciclo for para reducir tiempo en el siguiente loop
									j = results.getNearStations.length + 1
								}
							}
						}
						sendStations(senderID, stationFiltered , userLocation)

					}]
				}, function(err, results) {
						console.log(err)
						if(err) throw err
						User.remove(function(err) { if (err) throw err;});
						User.update({sender_id: senderID}, {
							status: 'RESOLVED',
						}, function(err, numberAffected, rawResponse) {
							console.log('Error')
						})
				});
			}
		});

}

function getUserLocation( attachments ){
	let userLocation = attachments.filter((item)=>{
		return item.type == 'location'
	}).map((item)=>{
		let coords = []; //coordinates [ <longitude> , <latitude> ]
		coords[0] = item.payload.coordinates.long;
		coords[1] = item.payload.coordinates.lat;
		return coords;
	});

	return ( userLocation.length > 0 ) ? userLocation[0] : null
}

function receivedPostback(event) {
  let senderID = event.sender.id;
	let payload = event.postback.payload;
	let timestamp = event.timestamp;

	switch (payload) {
		case 'START':
				sendWelcomeMessage(senderID);
				return;
			break;
		case 'GET_SLOT':
		case 'GET_BIKE':
				User.find({ sender_id: senderID }, function(err, data) {
				  if (err) throw err;

					if( data.length > 0 ){
						data[0].status = payload;
						data[0].save(function(err) { if (err) throw err; });
					}else{
						let userItem = {
							sender_id: senderID,
							status: payload,
							timestamp: timestamp
						}

						User.create(userItem);
					}

					sendLocationReply(senderID);
				});
			break;
		default:
			sendMoreStations(payload, senderID)
	}

}


function sendTextMessage(recipientId, messageText) {
  let messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText,
      metadata: 'DEVELOPER_DEFINED_METADATA'
    }
  };

  messagerApi.sendMessage(messageData);
}

function sendWelcomeMessage(recipientId) {

  let messageData = {
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
								{ type:'postback', title:'Buscar Bici', payload:'GET_BIKE' },
						    { type:'postback', title:'Encontrar Espacio', payload:'GET_SLOT'}
              ]
            }
          ]
        }
      }
    }
  };

  messagerApi.sendMessage(messageData);
}

function sendGraitudeMessage(recipientId){
	let gratitude = ['Es un gusto ayudarte 😄', 'Puedes compartirme con un amigo con este link https://goo.gl/r7WMVl', 'Esta es mi  página https://www.facebook.com/ecobotMX/']
	sendTextMessage(recipientId, gratitude[Math.floor(Math.random()*gratitude.length)]);
}

function sendApologizeMessage(recipientId) {

  let messageData = {
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
								{ type:'postback', title:'Encontrar 🚲', payload:'GET_BIKE' },
						    { type:'postback', title:'Encontrar 🅿️', payload:'GET_SLOT'}
              ]
            }
          ]
        }
      }
    }
  };

  messagerApi.sendMessage(messageData);
}

function sendLocationReply(recipientId) {
	let qArray = ['¿Cuál es tu ubicación?', '¿Dónde estás? 📍', '¿Por dónde estas?', '¿Me conpartes tu ubicación?']
	let text = qArray[ Math.floor(Math.random()*qArray.length) ]

  let messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: text,
      quick_replies: [{ 'content_type':'location' }]
    }
  };

  messagerApi.sendMessage(messageData);
}

function sendTyping(event, enable) {
  let messageData = {
    recipient: {
      id: event.sender.id
    },
    sender_action: ( enable ) ? 'typing_on' : 'typing_off'
  };

  messagerApi.sendMessage(messageData);
}

function sendStations(recipientId, locations, coords){

	let stationFiltered = locations.sort(function(a, b) {
		return a.distance - b.distance
	})

	let messageData = {
		  recipient:{
		    id :recipientId
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
										//image_url:'https://maps.googleapis.com/maps/api/staticmap?center=Brooklyn+Bridge,New+York,NY&zoom=13&size=600x300&maptype=roadmap&markers=color:blue%7Clabel:S%7C40.702147,-74.015794&markers=color:green%7Clabel:G%7C40.711614,-74.012318&markers=color:red%7Clabel:C%7C40.718217,-73.998284',
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
		if( i < 3 ){
			let elementList = createListElement( stationFiltered[i] , coords )
			messageData.message.attachment.payload.elements.push(elementList);
		}else{
			morePayload.stationsLeft.push(stationFiltered[i]);
		}
	}

	moreButton.payload = JSON.stringify(morePayload);

	if( morePayload.stationsLeft.length > 2 )
		messageData.message.attachment.payload.buttons.push(moreButton);

  messagerApi.sendMessage(messageData);
}

function sendMoreStations(payload, recipientId) {
	let data = JSON.parse(payload)
	console.log(data)
	console.log(data.coords)
	sendStations(recipientId, data.stationsLeft, data.coords)
}

function createListElement( station , userLoc ){

	let availabilityText = ( station.bikes != undefined  ) ? `${station['bikes']} 🚲` : `${station['slots']} 🏁`

	let distanceText = `${availabilityText} - ${parseFloat(station.distance).toFixed(1)} km`

	let mapUrl = `${process.env.SERVER_URL}/map?user_lat=${userLoc[1]}&user_long=${userLoc[0]}&stat_lat=${station.lat}&stat_long=${station.long}`

	let imageMap = `https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=200x200&scale=2&center=${station.lat},${station.long}&zoom=16&markers=${station.lat},${station.long}`

	return {
		title: station.name,
		image_url: imageMap,
		subtitle: distanceText,
		default_action: {
				type: 'web_url',
				url:mapUrl,
				messenger_extensions: true,
				webview_height_ratio: 'tall',
				fallback_url: mapUrl
		}
	}
}

function cleanStation( station, availability , coords, status){

	let parameter = ( status == 'GET_BIKE') ? 'bikes' : 'slots'

	if( availability[parameter] == 0 ) return null

	let cleanElement = cloneObjet( station )
	cleanElement[parameter] = availability[parameter]
	cleanElement.distance = distance(cleanElement.loc, coords);
	cleanElement.long = cleanElement.loc[0]
	cleanElement.lat = cleanElement.loc[1]
	delete cleanElement['_id'];
	delete cleanElement['ecobici_id'];
	delete cleanElement['address'];
	delete cleanElement['type'];
	delete cleanElement['__v'];
	delete cleanElement['loc'];
	return cleanElement;
}

function distance(a,b){
    const R = 6378 //6371000; // metros
    let φ1 = toRad( a[1] )
    let φ2 = toRad( b[1] )
    let Δφ = toRad( b[1] - a[1] )
    let Δλ = toRad( b[0] - a[0] )

    let x = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
    let y = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));

    return ( R * y ).toFixed(3);
}

function toRad(value) {
    return value * Math.PI / 180;
}

function cloneObjet( obj ){
	return JSON.parse(JSON.stringify(obj));
}
