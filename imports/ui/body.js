import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import { Streamers } from '../api/streamers.js';

import './body.html';

import Push from 'push.js'

//const streamersHandle = Meteor.subscribe('twitch.Streamers');

//TODO:
// Limit number of people returned
// Infinite scrolling?
// Pages?

Template.streamer_list.helpers({
    streamers() {
        return Streamers.find({
            usersToUpdate: Meteor.user()._id
        }, {
            limit: Template.instance().getLimit(),
            sort: {
                offline: 1,
                nameLower: 1
            }
        });
    },
});

Template.streamer_list.onCreated(function() {
    this.infiniteScroll({
        perPage: 10,
        query: {
            usersToUpdate: Meteor.user()._id
        },
        collection: 'streamers',
        publication: 'streamersInfinite'
    });
});

Template.body.events({
    'submit .new-streamer'(event) {
        event.preventDefault();
        const target = event.target;
        const text = target.text.value;

        const alreadyInDb = Streamers.findOne({nameLower: text.toLowerCase()});

        if (alreadyInDb){
            Meteor.call('streamers.addUser', alreadyInDb._id);
        } else {
            Meteor.call('streamers.insert', text);
        }

        target.text.value = '';
    },
    'submit .twitch-user'(event){
        event.preventDefault();
        const target = event.target;
        const text = target.text.value.trim();

        Meteor.call('twitch.addUserFollows', text);

        target.text.value = '';
    },
    'click .update'(event) {
        event.preventDefault();
        Meteor.call('twitch.forceUpdate');
        //Meteor.call('twitch.fetchData');
    },
    'click .delete'() {
        document.getElementById('streamer-'+this._id).style.display = 'none';
        Meteor.call('streamers.remove', this._id);
    }
});