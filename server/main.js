import { Meteor } from 'meteor/meteor';
import { HTTP } from 'meteor/http';

import { Streamers } from '../imports/api/streamers.js';

const POLL_INTERVAL = 300000; //ms?
const CLIENT_ID = Meteor.settings.twitchClientID; //In settings.json


Meteor.startup(()=>{
    //const interval = Meteor.setInterval(updateTwitchData, POLL_INTERVAL);
    updateTwitchData();
});

Meteor.methods({
    'twitch.forceUpdate'(){
        updateTwitchData();
    },
    'twitch.addUserFollows'(user){
        addUserFollows(user);
    }
});

const updateTwitchData = function(){
    const baseUrl = 'https://api.twitch.tv/kraken/streams/';

    updateChannelIDs();

    let streams = [];

    // let idList2 = [];

    const streamerFetch = Streamers.find().fetch();

    const groupSize = 500;

    const loopCount = Math.ceil(Streamers.find().count()/groupSize);
    const remainder = Streamers.find().count() % groupSize;

    for (var i = 0; i < loopCount; i++) {
       let idList = [];

        const startIndex = i * groupSize;
        const endIndex = startIndex + (i === loopCount-1 ? remainder : groupSize);

        for(var j = startIndex; j < endIndex; j++) {
            idList.push(streamerFetch[j].channelID);
        }

        const idStr = idList.join();

        // console.log(`Polling Twitch for: ${idList.length} users: ${idStr}`);
        console.log(`${i+1}/${loopCount} : Polling Twitch for ${idList.length} users.`);

        //Get stream data from Twitch
        const data = HTTP.get(baseUrl, {
            params: {
                channel: idStr,
                limit: 100
            },
            headers: {
                'Accept': 'application/vnd.twitchtv.v5+json',
                'Client-ID': CLIENT_ID
            }
        });

        streams = streams.concat(data.data.streams);


    }

    // Streamers.find().forEach((streamer, i)=>{
    //     if(i < 500)
    //         idList.push(streamer.channelID);
    //     // idList2.push(streamer.channelID);
    // });

    // const idStr = idList.join();
    // const idStr2 = idList2.join();

    // console.log(idList.length, idList2.length, idStr.length, idStr2.length);

    // //idList = idList.join();


    //console.log(`Polling Twitch for: ${idList.length} users: ${idStr}`);

    //Get stream data from Twitch
    // const data = HTTP.get(baseUrl, {
    //     params: {
    //         channel: idStr,
    //         limit: 100
    //     },
    //     headers: {
    //          'Accept': 'application/vnd.twitchtv.v5+json',
    //          'Client-ID': CLIENT_ID
    //     }
    // });

    //console.log(data);

    let onlineList = [];

    streams.forEach((stream)=>{
        stream._id = String(stream._id);
        onlineList.push(stream._id);

        if(Streamers.findOne(stream._id)) {
            //console.log("Found with _id", Streamers.findOne(stream._id).streamer);
            handleGameChange(stream);
            Streamers.update(stream._id, {
                $set: {
                    currentGame: stream.game,
                    offline: 0
                }
            });
        } else if (Streamers.findOne({
                    nameLower: stream.channel.name.toLowerCase()}))
        {
            console.log("Found with name", stream.channel.display_name);

            //Create copy of document to change random _id to Twitch's
            const oldDoc = Streamers.findOne({nameLower: stream.channel.name.toLowerCase()});
            const oldId = oldDoc._id;

            oldDoc._id = stream._id;

            Streamers.insert(oldDoc);

            handleGameChange(stream);

            Streamers.update(stream._id, {
                $set: {
                    currentGame: stream.game,
                    offline: 0,
                    name: stream.channel.display_name
                }
            });

            Streamers.remove(oldId);

        } else {
            console.log("ERROR: Stream not found\n", stream);
        }
    });

    //Change everybody to Offline
    //Probably works?
    Streamers.update({
        _id: { $nin: onlineList }
    }, {
        $set: {
            currentGame : "Offline",
            previousGame: "Offline",
            offline: 1
        }
    }, {
        multi: true
    })
}

const getUserInfo = function(names) {
    const baseUrl = 'https://api.twitch.tv/kraken/users/';
    const data = HTTP.get(baseUrl, {
        params: {
            login: names
        },
        headers: {
             'Accept': 'application/vnd.twitchtv.v5+json',
             'Client-ID': CLIENT_ID
        }
    });

    return data;

}

const updateChannelIDs = function() {

    let nameList = [];
    let idList = [];

    Streamers.find().forEach((streamer)=>{
        if(!streamer.channelID) {
            nameList.push(streamer.name);
            idList.push(streamer._id);
        }
    });

    if(nameList.length === 0)
        return;

    nameList = nameList.join();

    console.log("Updating ChannelIDs for:", nameList)

    const data = getUserInfo(nameList);

    data.data.users.forEach((user, index)=>{
        user._id = String(user._id);
        Streamers.update(idList[index], {
            $set: { channelID: user._id }
        })
    });
}

const handleGameChange = function(stream) {
    const streamer = Streamers.findOne(stream._id);

    if(stream.game !== streamer.currentGame) {
        Streamers.update(stream._id, {
            $set: { previousGame: streamer.currentGame }
        });

        if(streamer.currentGame === "Offline") {
            console.log(streamer.name, "has just come online, playing:", stream.game);
        } else {
            console.log(streamer.name, "has just started playing:", stream.game);
        }
    }
}

const addUserFollows = function(user){
    const userInfo = getUserInfo(user);

    userId = userInfo.data.users[0]._id;

    const baseUrl = 'https://api.twitch.tv/kraken/users/'+userId+'/follows/channels/'

    console.log(baseUrl);

    let follows = [];
    let loopAgain = true;
    let offset = 0;

    do {
        const data = HTTP.get(baseUrl, {
            params: {
                limit: 100,
                offset
            },
            headers: {
                'Accept': 'application/vnd.twitchtv.v5+json',
                'Client-ID': CLIENT_ID
            }
        });
        if( data.data.follows.length === 0) {
            loopAgain = false;
        } else {
            follows = follows.concat(data.data.follows);
            offset += 100;
        }
    } while(loopAgain);

    console.log(`Adding ${follows.length} for ${user}`);

    follows.forEach((user)=>{
        user.channel._id = String(user.channel._id);
        const alreadyInDb = Streamers.findOne({nameLower: user.channel.name.toLowerCase()});

        if(alreadyInDb) {
            Streamers.update(alreadyInDb._id, {
                $push: { usersToUpdate: Meteor.user()._id }
            })
        } else {
            Streamers.insert({
                name: user.channel.display_name,
                nameLower: user.channel.name.toLowerCase(),
                channelID: user.channel._id,
                currentGame: "Offline",
                previousGame: "Offline",
                usersToUpdate: [ Meteor.user()._id ]
            });
        }
    });
}