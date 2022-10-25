const nodemailer = require("nodemailer");
const { google } = require('googleapis')

const CLIENT_ID = '1062349257511-6dt9ucg5rb9q0qcvs8asllsv1fhersls.apps.googleusercontent.com';
const CLIENT_SECRET = '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'
const REDIRECT_URL = 'https://developers.google.com/oauthplayground'
const REFRESH_TOKEN = '1//04dEBe0pcohpmCgYIARAAGAQSNwF-L9IryZILpJ69rrXaKVfjGYPJ-OPwoLhxsJ-TYA5EC-ZadxCO8MuQhvbmKL3NDQHTRMnGmUw'
// async..await is not allowed in global scope, must use a wrapper

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL)
oAuth2Client.setCredentials({refresh_token: REFRESH_TOKEN})

function sendMail(err, type, files = []) {
  return new Promise(async (resolve, reject) => {
    // let accessToken = false
    try {
      const accessToken = await oAuth2Client.getAccessToken()
      console.log('accessToken', accessToken)
        // create reusable transporter object using the default SMTP transport
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: 'OAuth2',
          user: "appsinstallermainmail@gmail.com", // generated ethereal user
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: accessToken
        },
      });
      console.log('transporter', transporter)
      console.log('files', files)

      // send mail with defined transport object
      let info = await transporter.sendMail({
        from: 'appsinstallermainmail@gmail.com', // sender address
        to: "appsinstallermainmail@gmail.com", // list of receivers
        subject: type,
        text: err, // plain text body
        attachments: files
      });
      console.log('info', info)



      console.log("Message sent: %s", info.messageId, err);
      // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

      // Preview only available when sending through an Ethereal account
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
      resolve(info.messageId ? true : false)
      // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
      
    } catch {
      reject(false)
    }
  })
}

module.exports = {sendMail}