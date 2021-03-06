/*jshint node:true */
'use strict';

const assert = require('assert');
const request = require('request');
const util = require('util');
const MongooseRest = require('..');

//
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');

function TestServer(port, schema, options){
    mongoose.connect('mongodb://localhost/mongoose-rest_test', function(err){
        if(err){
            console.error('Unable to connect to mongodb test server');
        }
    });

    var TestSchema = new mongoose.Schema(schema);
    var TestModel = mongoose.model('TestModel', TestSchema);

    TestModel.remove({}, function(ret){
        console.log('Cleanup done');
    });

    //
    var app = express();
    app.set('port', process.env.PORT || 3000)
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    MongooseRest.route(app, TestModel, options);

    var server = http.createServer(app);
    server.listen(port, function(){
        console.log('Express test server listening on port: '+port);
    });

    //
    this.close = function(done){
        server.close();
        server = null;

        delete mongoose.models.TestModel;
        delete mongoose.modelSchemas.TestModel;
        mongoose.connection.close(done);
    }
}

function makeRequest(url, method, query, body){
    return new Promise(function(resolve, reject){
        request({
            url: url,
            method: method || 'GET',
            headers: {
                'Accept': 'application/json',
            },
            qs: query,
            json: body,
        }, function(err, response, body){
            if(!err && response.statusCode == 200){
                try{
                    var data = JSON.parse(body);
                }catch(SyntaxError){
                    var data = body;
                }
                return resolve(data)
            }
            reject(err ? err.stack : body);
        })
    });
}

function logResponse(res){
    console.log(util.inspect(res));
}

//
describe('MongooseRest tests', function(){
    const PORT = 12345;
    const URL = 'http://localhost:'+PORT+'/api/v1/TestModel';
    var server;

    before(function(){
        server = new TestServer(PORT, {
            _id: {
                type: Number,
            },
            user: { 
                type: String,
            },
            text: { 
                type: String,
            },
        }, {
            modelAuth: {
                _id: {
                    auth_view: true,
                    auth_edit: true,
                },
                user: {
                    auth_view: true,
                    auth_edit: true,
                },
                text: {
                    auth_view: true,
                    auth_edit: function(req){ return req.user === 'admin' },
                },
            },

            preAll: [
                function(req, res, next){
                    req.user = req.query.user;
                    next();
                }
            ],

            preList: [

            ],

            preGet: [

            ],
            
            preCreate: [
                
            ],

            preUpdate: [

            ],
            
            preDelete: [

            ],

        });
    });

    after(function(done){
        if(server){
            server.close(done);
            server = null;
        }
    });
    
    //
    it('add item as admin', function(){
        return makeRequest(URL, 'POST', { user: 'admin' }, {
            _id: 0,
            user: 'user0',
            text: 'text1',
        });
    });

    it('add item 1 as admin', function(){
        return makeRequest(URL, 'POST', { user: 'admin' }, {
            _id: 1,
            user: 'user1',
            text: 'text2',
        });
    });

    it('get item 1', function(){
        return makeRequest(URL+'/1', 'GET', {})
        .then(function(res){
            assert(res.text === 'text2');
        });
    });

    //
    it('list items', function(){
        return makeRequest(URL, 'GET', {}).then(logResponse);
    });

    //
    it('edit item 1 as admin', function(){
        return makeRequest(URL+'/1', 'PATCH', { user: 'admin' }, {
            text: 'text2 mod as admin',
        });
    });

    it('get item 1', function(){
        return makeRequest(URL+'/1', 'GET', {})
        .then(function(res){
            assert(res.text === 'text2 mod as admin');
        });
    });

    //
    it('edit item 1 as user', function(){
        return makeRequest(URL+'/1', 'PATCH', { user: 'user' }, {
            text: 'text2 mod as user',
        });
    });

    it('get item 1', function(){
        return makeRequest(URL+'/1', 'GET', {})
        .then(function(res){
            assert(res.text === 'text2 mod as admin');
        });
    });

    //
    it('delete items', function(){
        return Promise.all([
            makeRequest(URL+'/0', 'DELETE'),
            makeRequest(URL+'/1', 'DELETE'),
        ]);
    });

});

