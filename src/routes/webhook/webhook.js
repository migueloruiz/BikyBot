var express = require('express')
var router = express.Router()
var path = require('path')
var messageManage = require(path.join(__dirname, '../../controllers/messageManage'))

router.get('/', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === process.env.VALIDATION_TOKEN) {
    console.log('Validating webhook')
    res.status(200).send(req.query['hub.challenge'])
  } else {
    console.error('Failed validation. Make sure the validation tokens match.')
    res.sendStatus(403)
  }
})

router.post('/', function (req, res) {
  messageManage.processMessage(req.body)
  res.sendStatus(200)
})

module.exports = router
