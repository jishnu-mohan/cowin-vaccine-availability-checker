const request = require('request')
const cron = require('node-cron')

const CONFIG = require('./config')

const TELEGRAM_CHANNEL_ID = CONFIG.TELEGRAM_CHANNEL_ID
const TELEGRAM_BOT_API = CONFIG.TELEGRAM_BOT_API
const VACCINE_AVAILABILITY_API = CONFIG.VACCINE_AVAILABILITY_API
const DISTRICT_ID = CONFIG.DISTRICT_ID

// run every minutes
cron.schedule('* * * * *', () => {
  checkVaccineAvailabilityAndSendMessages()
})

function formatDate () {
  const date = new Date()
  const dd = date.getDate()
  const mm = date.getMonth() + 1
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function checkVaccineAvailabilityAndSendMessages () {
  const cowinQs = {
    district_id: DISTRICT_ID,
    date: formatDate()
  }

  request.get({
    url: VACCINE_AVAILABILITY_API,
    qs: cowinQs,
    json: true
  }, (err, response, body) => {
    if (err || (body && body.error)) {
      console.error('Error while fetching vaccine availability details', err, body)
      return null
    } else {
      const formattedSlotAvailability = formatCowinResponse(body)
      if (formattedSlotAvailability.length) {
        sendTelegramMessage(formattedSlotAvailability)
      } else {
        console.log('slot unavailable')
        return null
      }
    }
  })
}

function formatCowinResponse (cowinResponse) {
  const response = []
  if (cowinResponse && cowinResponse.centers && Array.isArray(cowinResponse.centers) && cowinResponse.centers.length) {
    cowinResponse.centers.forEach(vaccineCenter => {
      if (vaccineCenter.sessions && Array.isArray(vaccineCenter.sessions) && vaccineCenter.sessions.length) {
        vaccineCenter.sessions.forEach(session => {
          if (session.available_capacity > 0) {
            response.push({
              centerName: vaccineCenter.name,
              address: vaccineCenter.address,
              pinCode: vaccineCenter.pincode,
              date: session.date,
              ageLimit: session.min_age_limit,
              vaccine: session.vaccine,
              availability: session.available_capacity,
              slots: session.slots
            })
          }
        })
      }
    })
    return response
  } else {
    console.log('no centers available')
    return response
  }
}

function sendTelegramMessage (slotAvailability) {
  slotAvailability.forEach(slot => {
    const message = getTelegramMessage(slot)
    const qs = {
      chat_id: TELEGRAM_CHANNEL_ID,
      text: message
    }
    request.post({
      url: TELEGRAM_BOT_API,
      qs,
      json: true
    }, (err, response, body) => {
      if (err) {
        console.error('Error while sending message to telegram', err)
      } else {
        console.log('Send vaccine slot availability to telegram')
      }
    })
  })
}

function getTelegramMessage (slot) {
  const message =
  `🏥  Vaccination Slot Available 🏥 
    🏢 Center: ${slot.centerName}
    🔢 Date: ${slot.date}
    🗒 Address: ${slot.address}
    ❗️ PINCODE: ${slot.pinCode}
    💉 Vaccine: ${slot.vaccine}
    ⛔️ Age Limit: ${slot.ageLimit}
    ✅ Availability: ${slot.availability}
    ⏰ slots: ${slot.slots}
  `
  return message
}
