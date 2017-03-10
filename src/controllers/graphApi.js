var request = require('request')

module.exports = {
  getUserDataByID: (id) => {
    let options = {
      uri: `https://graph.facebook.com/v2.6/${id}`,
      qs: {
        fields: 'first_name',
        access_token: process.env.PAGE_ACCES_TOKEN
      },
      method: 'GET'
    }

    return new Promise(function (resolve, reject) {
      request(options, function (error, response, data) {
        if (error) return reject(error)
        if (response.statusCode !== 200) {
          let error = (data.hasOwnProperty('error')) ? data : new Error(`HTTP Error: ${response.statusCode} ${response.statusMessage}`)
          reject(error)
        }

        try {
          data = (data === '') ? {} : JSON.parse(data)
        } catch (parseError) {
          return reject(new Error(`JSON parseError with HTTP Status: ${response.statusCode} ${response.statusMessage}`))
        }
        resolve(data)
      })
    })
  }
}
