import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import { Streamers } from '../api/streamers.js';

import { mostSimilarString } from 'meteor/perak:fuzzy-search';

import './body.html';

import Push from 'push.js'

const streamersHandle = Meteor.subscribe('twitch.Streamers');

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
    searching() {
        const searchText = Template.instance().searchText.get();
        return searchText !== "";
    },
    searchedStreamer() {
        const searchText = Template.instance().searchText.get();

        const searchCursor = Streamers.find({
            usersToUpdate: Meteor.user()._id,
            nameLower: {
                $regex: searchText
            }
        });

        // If can't find with entered text, fuzzy search
        if(searchCursor.count() === 0 ) {
            const tempCursor = Streamers.find({usersToUpdate: Meteor.user()._id}, {nameLower: true});
            const bestWord = mostSimilarString(tempCursor, "nameLower", searchText, -1, false);

            return Streamers.find({
                nameLower: {
                    $regex: bestWord
                }
            });
        }
        return searchCursor;
    }
});

Template.streamer_list.onCreated(function() {
    //Enable infinite scrolling
    this.infiniteScroll({
        perPage: 10,
        query: {
            usersToUpdate: Meteor.user()._id
        },
        collection: 'streamers',
        publication: 'streamersInfinite'
    });

    //Reactive searching
    const instance = this;
    instance.searchText = new ReactiveVar("");
});

Template.streamer_list.events({
    'keyup .us-input': _.debounce(function(event, instance){
        text = event.target.value.trim().toLowerCase();

        instance.searchText.set(text);
    }, 200),
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
    },
    'click .delete'() {
        document.getElementById('streamer-'+this._id).style.display = 'none';
        Meteor.call('streamers.remove', this._id);
    }
});