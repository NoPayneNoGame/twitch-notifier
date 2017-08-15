import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { HTTP } from 'meteor/http';

export const Streamers = new Mongo.Collection('streamers');

Meteor.methods({
    'streamers.insert'(text){
        check(text, String);

        console.log(text);

        Streamers.insert({
            name: text,
            nameLower: text.toLowerCase(),
            channelID: null,
            currentGame: "Offline",
            previousGame: "Offline",
            offline: 1,
            usersToUpdate: [ Meteor.user()._id ]
        });
    },
    'streamers.addUser'(streamId){
        Streamers.update(streamId, {
            $push: { usersToUpdate: Meteor.user()._id }
        })
    },
    'streamers.remove'(streamId) {
        check(streamId, String);

        Streamers.update(streamId,{
            $pull: { usersToUpdate: Meteor.user()._id }
        });

        if(Streamers.findOne(streamId).usersToUpdate.length === 0) {
            Streamers.remove(streamId);
        }
    }
});

if(Meteor.isServer){
    Meteor.publish('twitch.Streamers', ()=>{
        return Streamers.find();
    });

    Meteor.publish('streamersInfinite', (limit, query)=>{
        var selector = {};
        check(limit, Number);
        check(query.usersToUpdate, String);
        // Assign safe values to a new object after they have been validated
        selector.usersToUpdate = query.usersToUpdate;

      	return Streamers.find(selector, {
            limit: limit,
            // Using sort here is necessary to continue to use the Oplog Observe Driver!
            // https://github.com/meteor/meteor/wiki/Oplog-Observe-Driver
            sort: {
                offline: 1,
                nameLower: 1
            }
        });
    });
}

    // Meteor.publish('twitch.getStreamData',()=>{
    //     const baseUrl = 'https://api.twitch.tv/kraken/streams/';
    //     const clientId = 's2hy5q7sbrmb4usu41yl3qe9m6lf4p';

    //     let nameList = "";
    //     Streamers.find().forEach((streamer)=>{
    //         nameList += streamer.streamer + ","
    //     });

    //     console.log(nameList);

    //     const poll = ()=>{
    //         const data = HTTP.get(baseUrl, {
    //             params: {
    //                 channel: nameList,
    //                 client_id: clientId
    //             }
    //         });

    //         Streamers.update({}, {
    //             $set: { currentGame: "Offline" }
    //         }, {
    //             multi: true
    //         });

    //         JSON.parse(data.content).streams.forEach((stream)=>{
    //             stream._id = String(stream._id);
    //             if(Streamers.findOne(stream._id)) {
    //                 //console.log("Found with _id", Streamers.findOne(stream._id).streamer);
    //                 Streamers.update(stream._id, {
    //                     $set: { currentGame: stream.game }
    //                 });
    //             } else if (Streamers.findOne({
    //                         streamerLower: stream.channel.name.toLowerCase()}))
    //             {
    //                 //console.log("Found with name");
    //                 const oldDoc = Streamers.findOne({streamerLower: stream.channel.name.toLowerCase()});
    //                 const oldId = oldDoc._id;

    //                 oldDoc._id = stream._id;
    //                 oldDoc.streamer = stream.channel.display_name;
    //                 oldDoc.currentGame = stream.game;

    //                 Streamers.insert(oldDoc);
    //                 Streamers.remove(oldId);

    //             } else {
    //                 console.log("ERROR: Stream not found\n", stream);
    //             }
    //             //console.log(stream);
    //         });
    //     };

    //     poll();
    //     return Streamers.find();
    // });
// }
// import { Meteor } from 'meteor/meteor';
// import { Mongo } from 'meteor/mongo';
// import { check } from 'meteor/check';

// import Push from 'push.js';

// export const Streamers = new Mongo.Collection('streamers');


// Meteor.methods({
//     'streamers.insert'(text) {
//         check(text, String);

//         console.log("Client?");

//         Meteor.call('twitch.getStreamData', text, function(err, resp){
//             if(err) {
//                 console.log('Returned with error:', err);
//             } else {
//                 console.log("No error");
//                 console.log(resp);
//                 // const stream = resp.data.streams[0];
//                 // console.log('Successfully returned:', stream);
//                 // Streamers.insert({
//                 //     _id: stream._id,
//                 //     streamer: stream.channel.display_name,
//                 //     streamerLower: text.toLowerCase(),
//                 //     currentGame: stream.game,
//                 //     previousGame: "Offline"
//                 // });
//             }
//         });

//         console.log("Client2?");

//     },

//     'twitch.getStreamData'(name) {
//         if(Meteor.isServer) {
//             this.unblock();
//             const resp = Meteor.wrapAsync(getStreamData)(name);
//             return resp;
//         }
//     },

//     'streamers.remove'(streamId) {
//         check(streamId, String);

//         // const streamer = Streamers.findOne(streamId);
//         // if (task.private && task.owner !== Meteor.userId()) {
//         //     throw new Meteor.Error('not-authorized');
//         // }

//         Streamers.remove(streamId);
//     },
//     'twitch.fetchData'() {
//         if(Meteor.isServer) {
//             this.unblock();

//             const baseUrl = 'https://api.twitch.tv/kraken/streams/';
//             const clientId = 's2hy5q7sbrmb4usu41yl3qe9m6lf4p';

//             let streamerList = '';
//             for (let i = 0; i < Streamers.find().fetch().length; i++) {
//                 const dbObj = Streamers.find().fetch()[i];
//                 streamerList += dbObj.streamer + ",";
//             }

//             try {
//                 const result = HTTP.call('GET', baseUrl, {
//                     params: {
//                         channel: streamerList,
//                         client_id: clientId
//                     }
//                 });

//                 const streams = result.data.streams;
//                 const streamNames = _.map(streams, function(item) { return item.channel.name.toLowerCase() });

//                 streams.forEach(function(streamData) {
//                     const streamName = streamData.channel.name.toLowerCase();
//                     const stream = Streamers.findOne({ streamerLower: streamName});

//                     console.log(streamName, streamData.game);

//                     Streamers.update(stream._id, { $set: {currentGame: streamData.game}});

//                     console.log(stream.currentGame, stream.previousGame);

//                     if(stream.currentGame !== stream.previousGame) {
//                         //Set account/user to be flagged to be notified
//                         //In a different place process all notifications
//                         //:ok_hand:
//                         //Meteor.call('notifyHandler', stream);
//                         Streamers.update(stream._id, { $set: {previousGame: stream.currentGame}});
//                     }

//                 }, this);

//                 Streamers.update( { streamerLower: { $nin: streamNames } },
//                                   { $set: { currentGame: "Offline" } },
//                                   { multi: true } );

//                 //console.log(Streamers.find({streamer: {$nin: streamNames}}).fetch());
//             } catch (error) {
//                 console.log(error);
//             }
//         } else {
//             console.log(Streamers.find().fetch());
//         }
//     },
//     'notifyHandler'(stream) {
//         if(Meteor.isClient){
//             const currGame = stream.currentGame;
//             const prevGame = stream.previousGame;
//             const name = stream.streamer;

//             console.log("thinking");

//             Push.create("Help");
//         }
//         // Push.create(name + " has changed from " + prevGame + " to " +currGame, {
//         //     body: "Click to head to their channel.",
//         //     timeout: 4000,
//         //     onClick: function() {
//         //         //window.open("https://twitch.tv/"+name);
//         //         window.focus();
//         //         this.close();
//         //     }
//         // });

//     }
// });

// const getStreamData = function(channel, callback){
//     const baseUrl = 'https://api.twitch.tv/kraken/streams/';
//     const clientId = 's2hy5q7sbrmb4usu41yl3qe9m6lf4p';

//     try {
//         const resp = HTTP.call('GET', baseUrl, {
//             params: {
//                 channel: channel,
//                 client_id: clientId
//             }
//         });

//         callback(null, resp);

//     } catch (error) {
//         if(error.response) {
//             const errorCode = error.response.data.code;
//             const errorMessage = error.response.data.message;
//         } else {
//             const errorCode = 500;
//             const errorMessage = 'Cannot access the API';
//         }
//         const apiError = new Meteor.Error(errorCode, errorMessage)
//         callback(apiError, null);
//     }
// }
