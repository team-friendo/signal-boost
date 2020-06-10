module.exports.create = () => {

  let _inFlight = {}

  function inFlight(username) {
    return _inFlight[username] || 0
  }
  
  function launch(username, recipients) {
    _inFlight[username] = inFlight(username) + recipients.length
    return inFlight(username)
  }

  function landOne(username) {
    _inFlight[username] = inFlight(username) - 1
  }

  function signaldMessageReceived: (msg) {
    
  }

  return { signaldMessageReceived }
}

/*

Example sequence of messages received from signald when sending a message 
to channel (username) +12055286172 from source phonenumber +13478536343.

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":1,"type":1,"hasRelay":false,"timestamp":1591757728825,"timestampISO":"2020-06-10T02:55:28.825Z","serverTimestamp":1591757730580,"hasLegacyMessage":false,"hasContent":true,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":false,"isUnidentifiedSender":false,"dataMessage":{"timestamp":1591757728825,"message":"Test 1055","expiresInSeconds":604800,"attachments":[]}}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":2,"type":5,"hasRelay":false,"timestamp":1591757597371,"timestampISO":"2020-06-10T02:53:17.371Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+18319176400","hasSourceDevice":true,"sourceDevice":2,"type":5,"hasRelay":false,"timestamp":1591757597357,"timestampISO":"2020-06-10T02:53:17.357Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+16154804259","hasSourceDevice":true,"sourceDevice":5,"type":5,"hasRelay":false,"timestamp":1591757597377,"timestampISO":"2020-06-10T02:53:17.377Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+18319176400","hasSourceDevice":true,"sourceDevice":1,"type":5,"hasRelay":false,"timestamp":1591757597357,"timestampISO":"2020-06-10T02:53:17.357Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+16154804259","hasSourceDevice":true,"sourceDevice":1,"type":5,"hasRelay":false,"timestamp":1591757597377,"timestampISO":"2020-06-10T02:53:17.377Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":1,"type":5,"hasRelay":false,"timestamp":1591757597371,"timestampISO":"2020-06-10T02:53:17.371Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}

{"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":1,"type":1,"hasRelay":false,"timestamp":1591757732763,"timestampISO":"2020-06-10T02:55:32.763Z","serverTimestamp":1591757734162,"hasLegacyMessage":false,"hasContent":true,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":false,"isUnidentifiedSender":false,"receipt":{"type":"READ","timestamps":[1591757597371],"when":1591757732763}}}

example of sending message to same channel from +16154804259

app_1         | {"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+16154804259","hasSourceDevice":true,"sourceDevice":1,"type":1,"hasRelay":false,"timestamp":1591759008822,"timestampISO":"2020-06-10T03:16:48.822Z","serverTimestamp":1591759009048,"hasLegacyMessage":false,"hasContent":true,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":false,"isUnidentifiedSender":false,"dataMessage":{"timestamp":1591759008822,"message":"test!","expiresInSeconds":604800,"attachments":[]}}}
app_1         | 
app_1         | {"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+16154804259","hasSourceDevice":true,"sourceDevice":1,"type":5,"hasRelay":false,"timestamp":1591758875545,"timestampISO":"2020-06-10T03:14:35.545Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}
app_1         | 
app_1         | {"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":2,"type":5,"hasRelay":false,"timestamp":1591758875548,"timestampISO":"2020-06-10T03:14:35.548Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}
app_1         | {"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+16154804259","hasSourceDevice":true,"sourceDevice":5,"type":5,"hasRelay":false,"timestamp":1591758875545,"timestampISO":"2020-06-10T03:14:35.545Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}
app_1         | {"type":"message","data":{"username":"+12055286172","hasUuid":false,"hasSource":true,"source":"+13478536343","hasSourceDevice":true,"sourceDevice":1,"type":5,"hasRelay":false,"timestamp":1591758875548,"timestampISO":"2020-06-10T03:14:35.548Z","serverTimestamp":0,"hasLegacyMessage":false,"hasContent":false,"isSignalMessage":false,"isPrekeySignalMessage":false,"isReceipt":true,"isUnidentifiedSender":false}}



*/
