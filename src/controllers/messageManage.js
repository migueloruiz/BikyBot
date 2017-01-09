var async = require('async')
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
				sendGraitudeMessage(recipientId);
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
					let status = data[0].status;
					let location = attachment[0].payload.coordinates;

					async.auto({
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
						getNearStations: ['get_ecobici_access','get_bikeStationStatus', (results, cb) => {
						  //coordinates [ <longitude> , <latitude> ]
						  var coords = [];
						  coords[0] = location.long
						  coords[1] = location.lat
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
									sendList(senderID, locationsData, coords)
									cb(null, locationsData);
								}else{
									sendTextMessage(senderID, 'Lo lamento no hay estaciones cerca de tu ubicación');
									cb('Lo lamento no hay estaciones cerca de tu ubicacción', null);
								}
							})
						}]
					}, function(err, results) {
							console.log(err)
							if(err) throw err
							User.remove(function(err) { if (err) throw err;});
					});
				}
			});
		}
	}
}

function receivedAttachment(event){

}

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
						sendLocationReply(senderID);
					}else{
						let userItem = {
							sender_id: senderID,
							status: payload,
							timestamp: timestamp
						}

						User.create(userItem);
						sendLocationReply(senderID);
					}
				});
			break;
		case 'NOT_ACTIVE':
				sendTextMessage(senderID, 'Por el momento esta función no esta disponible');
			break;
		default:
			sendTextMessage(senderID, payload);
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

function sendList(recipientId, locations, coords){

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

	var morePayload = {
		long: coords[0],
		lat: coords[1],
		stationsSeen: []
	}

	var moreButton = {
			title: 'Ver más',
			type: 'postback',
			payload: ''
	}

	for (var i = 0; i < 3; i++) {
		morePayload.stationsSeen.push(locations[i].ecobici_id);
		let distanceText = `5 🚲 - ${distance(locations[i].loc,coords)} km`
		let elementInList = {
			title: locations[i].name,
			image_url: `https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=100x100&scale=2&center=${locations[i].loc[1]},${locations[i].loc[0]}&zoom=15&markers=${locations[i].loc[1]},${locations[i].loc[0]}`,
			subtitle: distanceText,
			default_action: {
					type: 'web_url',
					url:
					`${process.env.SERVER_URL}/map?user_lat=${locations[i].loc[1]}&user_long=${locations[i].loc[0]}&stat_lat=${coords[1]}&stat_long=${coords[0]}`,
					messenger_extensions: true,
					webview_height_ratio: 'tall',
					fallback_url: `${process.env.SERVER_URL}/map?user_lat=${locations[i].loc[1]}&user_long=${locations[i].loc[0]}&stat_lat=${coords[1]}&stat_long=${coords[0]}`
			}
		}
		messageData.message.attachment.payload.elements.push(elementInList);
	}

	moreButton.payload = JSON.stringify(morePayload);
	messageData.message.attachment.payload.buttons.push(moreButton);

  messagerApi.sendMessage(messageData);
}

var distance = function(a,b){
    var lat1 = a[1];
    var lat2 = b[1];
    var lon1 = a[0];
    var lon2 = b[0];
    var R = 6378;//6371000; // metres
    var φ1 = toRad(lat1)
    var φ2 = toRad(lat2)
    var Δφ = toRad(lat2-lat1)
    var Δλ = toRad(lon2-lon1)

    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    var d = R * c;
    return d.toFixed(1);
}

var toRad = function(Value) {
    return Value * Math.PI / 180;
}
