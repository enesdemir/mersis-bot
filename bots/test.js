const moment = require('moment');

const philliTime = moment('2021-08-23 16:07:00', 'YYYY-MM-DD HH:mm:ss').add(2, 'm');

console.log(philliTime.diff(moment(),'s'));

/*
const redis = require('redis');

const subscriber = redis.createClient();

subscriber.on("message",(channel,message) => {
    console.log("Received data :"+message);
})

subscriber.subscribe("user-notify");
*/
