var async = require('async')
var mongoose = require('mongoose');
var BikeStation = mongoose.model('BikeStation');
var User = mongoose.model('User')
var path = require('path')
var messagerApi = require(path.join(__dirname, 'messegerApi'))
var request = require('request');
var JSON = require('json-strictify');

module.exports = {
	processMessage: function ( messageData ) {
		console.log(messageData)
		messageData.entry.forEach(function(pageEntry) {
			pageEntry.messaging.forEach(function(messagingEvent) {
				sendTyping(messagingEvent, true)
				if (messagingEvent.message) receivedMessage(messagingEvent);
				if (messagingEvent.postback) receivedPostback(messagingEvent);
			});
		});
	}
}

function receivedMessage(event) {
  var senderID = event.sender.id;
  var message = event.message;

	// let quick_reply = message.quick_reply;
  // if (quick_reply) {
  //   var quickReplyPayload = quick_reply.payload;
  //   sendTextMessage(senderID, 'Quick reply tapped');
  //   return;
  // }

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
        sendApologizeMessage(senderID)
				return;
    }
  }

	if(message.attachments){
		let attachment = message.attachments.filter((item)=>{
			return item.type == 'location'
		});

		if( attachment.length > 0 ){
			User.find({ sender_id: senderID }, function(err, data) {
				if (err) throw err;

				if( data.length > 0 ){
					let userStatus = data[0].status;

					//coordinates [ <longitude> , <latitude> ]
					let coords = [];
					coords[0] = attachment[0].payload.coordinates.long;
					coords[1] = attachment[0].payload.coordinates.lat;

					async.auto({
						getNearStations: (cb) => {
							// var maxDistance = 2 //2 km   8/6371;

						  BikeStation.find({
						    loc: {
						      $near: coords,
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
							var url = `https://pubsbapi.smartbike.com/oauth/v2/token?client_id=${process.env.ECO_CLIENT_ID}&client_secret=${process.env.ECO_CLIENT_SECRET}&grant_type=client_credentials`
							request(url, function (err, response, body) {
								if (err) throw err
								if (!err && response.statusCode == 200) {
									var data = JSON.parse(body);
									cb(null, data.access_token);
								}
							})
				    },
						get_bikeStationStatus: ['get_ecobici_access', (results, cb) => {

							var url = `https://pubsbapi.smartbike.com/api/v1/stations/status.json?access_token=${results.get_ecobici_access}`
							request(url, function (err, response, body) {
								if (err) throw err
								if (!err && response.statusCode == 200) {
									var data = JSON.parse(body);
									cb(null, data.stationsStatus);
								}
							})
						}],
						filterStatios: ['get_bikeStationStatus','getNearStations', (results, cb) => {

							var stationFiltered = [];
							for (let i = 0; i < results.get_bikeStationStatus.length; i++) {
								for (let j = 0; j < results.getNearStations.length; j++) {
									if(results.getNearStations[j].ecobici_id == results.get_bikeStationStatus[i].id){
										let item = cleanStation( results.getNearStations[j], results.get_bikeStationStatus[i].availability , coords, userStatus )
										stationFiltered.push(item)
									}
								}
							}

							sendStations(senderID, stationFiltered , coords)

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
	}
}

// function receivedAttachment(event){
//
// }

function receivedPostback(event) {
  var senderID = event.sender.id;
	var payload = event.postback.payload;
	var timestamp = event.timestamp;

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
  var messageData = {
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

  var messageData = {
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
	var gratitude = ['Es un gusto ayudarte 😄', 'Puedes compartirme con un amigo con este link https://goo.gl/r7WMVl', 'Esta es mi  página https://www.facebook.com/ecobotMX/']
	sendTextMessage(recipientId, gratitude[Math.floor(Math.random()*gratitude.length)]);
}

function sendApologizeMessage(recipientId) {

  var messageData = {
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

  var messageData = {
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
  var messageData = {
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

	var messageData = {
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

	if( morePayload.stationsLeft.length > 3 )
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
	let cleanElement = cloneObjet( station )
	let parameter = ( status == 'GET_BIKE') ? 'bikes' : 'slots'
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
