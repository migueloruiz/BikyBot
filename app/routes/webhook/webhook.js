var express = require('express')
var router = express.Router()
var mongoose = require('mongoose');
var BikeStation = mongoose.model('BikeStation');
var request = require('request');

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

// //http://localhost:3000/webhook/test?longitude=23.600800037384033&latitude=46.76758746952729
// router.get('/test', function (req, res) {
//   var maxDistance = 2//8/6371;
//
//   //coordinates [ <longitude> , <latitude> ]
// 	console.log(req.query.longitude , req.query.latitude );
//   var coords = [];
//   coords[0] = req.query.longitude || 0;
//   coords[1] = req.query.latitude || 0;
//
//   // // find a location
//   BikeStation.find({
//     loc: {
//       $near: coords,
//       $maxDistance: maxDistance
//     }
//   }).limit(10).exec(function(err, locations) {
//   	if (err){
// 			res.status(500)
// 			res.json(err)
// 			return;
// 		}
// 		if(locations.length > 0){
// 			let locWithDistance = locations.map((item)=>{
// 				item['distance'] = distance(coords,item.loc)
// 				console.log(item.name,distance(coords,item.loc))
// 				return item
// 			})
// 			res.json(locWithDistance)
// 		}else{
// 			res.json({error:'no hay estaciones cerca de tu locacion'})
// 		}
// 		res.status(200)
// 	})
// })
//
// var distance = function(a,b){
//     var lat1 = a[1];
//     var lat2 = b[1];
//     var lon1 = a[0];
//     var lon2 = b[0];
//     var R = 6378;//6371000; // metres
//     var φ1 = toRad(lat1)
//     var φ2 = toRad(lat2)
//     var Δφ = toRad(lat2-lat1)
//     var Δλ = toRad(lon2-lon1)
//
//     var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
//         Math.cos(φ1) * Math.cos(φ2) *
//         Math.sin(Δλ/2) * Math.sin(Δλ/2);
//     var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//
//     var d = R * c;
//     return d;
// }
//
// var toRad = function(Value) {
//     return Value * Math.PI / 180;
// }

router.post('/', function (req, res) {
	console.log('=======================================================================')
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    data.entry.forEach(function(pageEntry) {
      var pageID = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      // Iterate over each messaging event
			console.log('messaging===========',pageEntry.messaging)
      pageEntry.messaging.forEach(function(messagingEvent) {

				if (messagingEvent.message) receivedMessage(messagingEvent);
				if (messagingEvent.postback) receivedPostback(messagingEvent);

      });
    });

    // Assume all went well.
    res.sendStatus(200);
  }
});

function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var isEcho = message.is_echo;
  var messageId = message.mid;
  var appId = message.app_id;
  var metadata = message.metadata;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var messageAttachments = message.attachments;
  var quickReply = message.quick_reply;

  if (isEcho) {
    // Just logging message echoes to console
    console.log("Received echo for message %s and app %d with metadata %s",
      messageId, appId, metadata);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    console.log("Quick reply for message %s with payload %s",
      messageId, quickReplyPayload);

    sendTextMessage(senderID, "Quick reply tapped");
    return;
  }

  if (messageText) {

    // If we receive a text message, check to see if it matches any special
    // keywords and send back the corresponding example. Otherwise, just echo
    // the text we received.
    switch (messageText) {
      case 'button':
        sendButtonMessage(senderID);
        break;

      case 'generic':
        sendGenericMessage(senderID);
        break;

      case 'quick reply':
        sendQuickReply(senderID);
        break;

      case 'read receipt':
        sendReadReceipt(senderID);
        break;

      case 'typing on':
        sendTypingOn(senderID);
        break;

      case 'typing off':
        sendTypingOff(senderID);
        break;

      case 'account linking':
        sendAccountLinking(senderID);
        break;

			case 'List':
				sendList(senderID);
				break;

      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendTextMessage(senderID, "Message with attachment received");
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback
  // button for Structured Messages.
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to
  // let them know it was successful
  sendTextMessage(senderID, "Postback called");
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

function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPER_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendGenericMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",
            image_url: SERVER_URL + "/assets/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",
            image_url: SERVER_URL + "/assets/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };

  callSendAPI(messageData);
}

function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "¿Cual es tu ubucacion?",
      quick_replies: [
        // {
        //   "content_type":"text",
        //   "title":"Action",
        //   "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        // },
        // {
        //   "content_type":"text",
        //   "title":"Comedy",
        //   "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_COMEDY"
        // },
        // {
        //   "content_type":"text",
        //   "title":"Drama",
        //   "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_DRAMA"
        // },
				{
	        "content_type":"location",
					"payload":"LOCATION"
	      }
      ]
    }
  };

  callSendAPI(messageData);
}

function sendTypingOn(recipientId) {
  console.log("Turning typing indicator on");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_on"
  };

  callSendAPI(messageData);
}

function sendTypingOff(recipientId) {
  console.log("Turning typing indicator off");

  var messageData = {
    recipient: {
      id: recipientId
    },
    sender_action: "typing_off"
  };

  callSendAPI(messageData);
}

function sendList(recipientId){
	var messageData = {
		  recipient:{
		    id :recipientId
		  },
			message: {
		    attachment: {
		        type: 'template',
		        payload: {
		            template_type: 'list',
		            elements: [
		                {
		                    title: 'Classic Black T-Shirt',
		                    image_url: 'http://lorempixel.com/g/400/200/city/',
		                    subtitle: '100% Cotton, 200% Comfortable',
		                    default_action: {
		                        type: 'web_url',
		                        url: 'https://google.com',
		                        messenger_extensions: true,
		                        webview_height_ratio: 'tall',
		                        fallback_url: 'https://google.com'
		                    },
		                    buttons: [
		                        {
		                            title: 'Shop Now',
		                            type: 'web_url',
		                            url: 'https://google.comshop?item=102',
		                            messenger_extensions: true,
		                            webview_height_ratio: 'tall',
		                            fallback_url: 'https://google.com'
		                        }
		                    ]
		                },
										{
		                    title: 'Classic Black T-Shirt',
		                    image_url: 'http://lorempixel.com/g/400/200/city/',
		                    subtitle: '100% Cotton, 200% Comfortable',
		                    default_action: {
		                        type: 'web_url',
		                        url: 'https://google.com',
		                        messenger_extensions: true,
		                        webview_height_ratio: 'tall',
		                        fallback_url: 'https://google.com'
		                    },
		                    buttons: [
		                        {
		                            title: 'Shop Now',
		                            type: 'web_url',
		                            url: 'https://google.comshop?item=102',
		                            messenger_extensions: true,
		                            webview_height_ratio: 'tall',
		                            fallback_url: 'https://google.com'
		                        }
		                    ]
		                },
										{
		                    title: 'Classic Black T-Shirt',
		                    image_url: 'http://lorempixel.com/g/400/200/city/',
		                    subtitle: '100% Cotton, 200% Comfortable',
		                    default_action: {
		                        type: 'web_url',
		                        url: 'https://google.com',
		                        messenger_extensions: true,
		                        webview_height_ratio: 'tall',
		                        fallback_url: 'https://google.com'
		                    },
		                    buttons: [
		                        {
		                            title: 'Shop Now',
		                            type: 'web_url',
		                            url: 'https://google.comshop?item=102',
		                            messenger_extensions: true,
		                            webview_height_ratio: 'tall',
		                            fallback_url: 'https://google.com'
		                        }
		                    ]
		                }
		            ],
		             buttons: [
		                {
		                    title: 'View More',
		                    type: 'postback',
		                    payload: 'payload'
		                }
		            ]
		        }
		    }
		}
	}

	callSendAPI(messageData);
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
