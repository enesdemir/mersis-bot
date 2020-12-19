
const redis = require('redis');

const subscriber = redis.createClient();

subscriber.on("message",(channel,message) => {
    console.log("Received data :"+message);
})

subscriber.subscribe("user-notify");
