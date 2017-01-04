var express = require('express')
var router = express.Router()

router.get('/', function (req, res, next) {
  res.render('index', {
    title: process.env.PROJECT,
    atributes: {
      messenger_app_id: process.env.FB_APP_ID,
      page_id: process.env.FB_PAGE_ID
    }
  })
})

module.exports = router
