var express = require('express')
var router = express.Router()
var request = require('request');
var async = require('async')
var mongoose = require('mongoose');
var BikeStation = mongoose.model('BikeStation');
var User = mongoose.model('User')

router.get('/', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === req.app.get('VALIDATION_TOKEN')) {
    console.log('Validating webhook')
    res.status(200).send(req.query['hub.challenge'])
  } else {
    console.error('Failed validation. Make sure the validation tokens match.')
    res.sendStatus(403)
  }
})

router.post('/', function (req, res) {
  var data = req.body;
	console.log('=======================================================================')
  console.log('Body',JSON.stringify(req.body))

  if (data.object == 'page') {
    data.entry.forEach(function(pageEntry) {
      pageEntry.messaging.forEach(function(messagingEvent) {
				sendTyping(messagingEvent, true)
				if (messagingEvent.message) receivedMessage(messagingEvent);
				if (messagingEvent.postback) receivedPostback(messagingEvent);
      });
    });

    res.sendStatus(200);
  }
});

function receivedMessage(event) {
  var senderID = event.sender.id;
  var message = event.message;

	// let quick_reply = message.quick_reply;
  // if (quick_reply) {
  //   var quickReplyPayload = quick_reply.payload;
  //   sendTextMessage(senderID, "Quick reply tapped");
  //   return;
  // }

	let text = message.text
  if (text) {
    switch (text) {
			case 'hola':
			case 'Hola':
				sendWelcomeMessage(senderID);
				return;
      default:
        sendApologizeMessage(senderID)
				return;
    }
  }

	let attachment = message.attachments.filter((item)=>{
		return item.type == 'location'
	});

	if( attachment.length > 0 ){
		User.find({ sender_id: senderID }, function(err, data) {
			if (err) throw err;

			if( data.length > 0 ){
				let status = data[0].status;
				let location = attachment[0].payload.coordinates;
				console.log(location)

				async.auto({
			    get_ecobici_access: (cb) =>{
						var url = `https://pubsbapi.smartbike.com/oauth/v2/token?client_id=${process.env.ECO_CLIENT_ID}&client_secret=${process.env.ECO_CLIENT_SECRET}&grant_type=client_credentials`
						request(url, function (err, response, body) {
							if (err) throw err
							console.log(response.statusCode)
							if (!err && response.statusCode == 200) {
								var data = JSON.parse(body);
								console.log(data.access_token)
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
								cb('Lo lamento no hay estaciones cerca de tu ubicaccion', null);
							}
						})
					}]
				}, function(err, results) {
						console.log(err)
						if(err) throw err
						User.remove(function(err) {
					    if (err) throw err;
					    console.log('User successfully deleted!');
					  });
						return;
				});
			}
		});
	}
}

function receivedPostback(event) {
  var senderID = event.sender.id;
	var payload = event.postback.payload;
	var timestamp = event.timestamp;

	switch (payload) {
		case 'START':
				sendWelcomeMessage(senderID);
			break;
		case 'GET_SLOT':
		case 'GET_BIKE':
				User.find({ sernder_id: senderID }, function(err, data) {
				  if (err) throw err;

					console.log('Search',data);
					if( data.length > 0 ){
						data[0].status = payload;
						data[0].save(function(err) {
							console.log('Base de datos')
					    if (err) throw err;
					    console.log('User successfully updated!');
					  });
						sendLocationReply(senderID);
					}else{
						let userItem = {
							sender_id: senderID,
							status: payload,
							timestamp: timestamp
						}
						console.log('New user');
						User.create(userItem);
						sendLocationReply(senderID);
					}
				});
			break;
		case 'NOT_ACTIVE':
				sendTextMessage(senderID, 'Por el momento esta funcion no esta disponible');
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
      metadata: "DEVELOPER_DEFINED_METADATA"
    }
  };

  callSendAPI(messageData);
}

function sendWelcomeMessage(recipientId) {

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: '¡Hola! ¿En que te podemos ayudar?',
              subtitle: 'Hacemos te tu viaje el mas sencillo 🚴',
              image_url: "https://baconmockup.com/300/200",
              buttons: [
								{ type:'postback', title:'Encontrar Bici', payload:'GET_BIKE' },
						    { type:'postback', title:'Encontrar Espacio', payload:'GET_SLOT'}
              ]
            }
          ]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendApologizeMessage(recipientId) {

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: '¡Aun no soy tan listo! 😅 ',
              subtitle: 'Por el momento te puedo ayudar con estas tareas 💪',
              image_url: "https://baconmockup.com/300/200",
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

  callSendAPI(messageData);
}

function sendLocationReply(recipientId) {
	let qArray = ["¿Cual es tu ubicacion?", "¿Donde estas?", "¿Por donde andas?", "¿Me conpartes tu ubicación?"]
	let text = qArray[ Math.round( Math.random() * qArray.lenght - 1 ) ]

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "¿Cual es tu ubicación?",
      quick_replies: [{ "content_type":"location" }]
    }
  };

  callSendAPI(messageData);
}

function sendTyping(event, enable) {
	var senderID = event.sender.id;
  console.log( ( enable ) ? "typing_on" : "typing_off" );
  var messageData = {
    recipient: {
      id: senderID
    },
    sender_action: ( enable ) ? "typing_on" : "typing_off"
  };
  callSendAPI(messageData);
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
		                    image_url: process.env.SERVER_URL + "/assets/images/fondo.jpg",
		                    subtitle: 'En estas estaciones hay lugare disponibles'
		                }
		            ],
		             buttons: [
		                {
		                    title: 'Ver más',
		                    type: 'postback',
		                    payload: 'NOT_ACTIVE'
		                }
		            ]
		        }
		    }
		}
	}

	for (var i = 0; i < 3; i++) {
		let distanceText = `A ${distance(locations[i].loc,coords)} km`
		let elementInList = {
			title: locations[i].address,
			image_url: `https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=764x400&center=${locations[i].loc[1]},${locations[i].loc[0]}&zoom=18&markers=${locations[i].loc[1]},${locations[i].loc[0]}`,
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

	callSendAPI(messageData);
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
    return d.toFixed(2);
}

var toRad = function(Value) {
    return Value * Math.PI / 180;
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: process.env.PAGE_ACCES_TOKEN },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s",
          messageId, recipientId);
      } else {
      console.log("Successfully called Send API for recipient %s",
        recipientId);
      }
    } else {
      console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
    }
  });
}

module.exports = router
