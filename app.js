// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/

// Define constants
const createError = require('http-errors');
const express = require('express');
const session = require('express-session');
const redis = require('redis');
const RedisServer = require('redis-server');
const redisServer = new RedisServer({conf: './redis/conf/redis.conf', bin: './redis/bin/redis-server',});
const redisStore = require('connect-redis')(session);
const redisClient = redis.createClient({legacyMode: true}); // legacyMode: true is required for Redis v4+
// TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
// let redisSubscriber;
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const stylus = require('stylus');
const https = require("https");
const fs = require("fs");
const db = require('./lib/common/database');

// SSL Certificates and Configuration
const sslPrivateKey = fs.readFileSync(path.resolve(__dirname, './certs/privkey.pem'), 'utf-8');
const sslPublicKey = fs.readFileSync(path.resolve(__dirname, './certs/pubkey.pem'), 'utf-8');
const sslCAKey = fs.readFileSync(path.resolve(__dirname, './certs/selfca.pem'), 'utf-8');
const sslCredentials = {key: sslPrivateKey, cert: sslPublicKey, ca: sslCAKey};

// Define constants for routers - Server Side
const loginBeRouter = require('./routes/backend/login');
const nodesBeRouter = require('./routes/backend/nodes');
const resourcesBeRouter = require('./routes/backend/resources');

// Define constants for routers - Client Side
const indexFeRouter = require('./routes/frontend/index');
const loginFeRouter = require('./routes/frontend/login');

// Define express application
const app = express();
const server = https.createServer(sslCredentials, app);

// Define application functions
async function startRedis() {
    //TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
    //redisSubscriber = redisClient.duplicate();
    // Setup redis event loggers
    redisServer.on('error', (err) => {
        console.log('Redis Server [ERROR]: ' + err);
    });
    redisClient.on('error', (err) => {
        console.log('Redis Client [ERROR]: ' + err);
    });
    // TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
/*    redisSubscriber.on('error', (err) => {
        console.log('Redis Subscriber [ERROR]: ' + err);
    });
    redisSubscriber.on('message', (channel, message) => {
        console.log('Redis Subscriber [MESSAGE]: ' + channel + ': ' + message);
    });*/
    // Start the redis server
    try {
        await redisServer.open();
        console.log('Redis server started');
    } catch (err) {
        throw new Error('Redis server failed to start' + err);
    }
    // Start the redis client
    try {
        await redisClient.connect();
        await redisClient.sendCommand('config', ['set','notify-keyspace-events','Ex']);
        console.log('Redis client started');
    } catch (err) {
        throw new Error('Redis client failed to start' + err);
    }
    // TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
    // Start the redis subscriber
    /*try {
        await redisSubscriber.connect();
        await redisSubscriber.subscribe('__keyevent@0__:expired');
        console.log('Redis subscriber started');
        TestKey();
    } catch (err) {
        throw new Error('Redis subscriber failed to start' + err);
    }*/
}
async function stopRedis() {
    // TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
    // Stop the redis subscriber
    /*try {
        await redisSubscriber.quit();
        console.log('Redis subscriber stopped');
    } catch (err) {
        throw new Error('Redis subscriber failed to stop' + err);
    }*/
    // Stop the redis client
    try {
        await redisClient.quit();
        console.log('Redis client stopped');
    } catch (err) {
        throw new Error('Redis client failed to stop' + err);
    }
    // Stop the redis server
    try {
        await redisServer.close();
        console.log('Redis server stopped');
    } catch (err) {
        throw new Error('Redis server failed to stop' + err);
    }
}

// TODO: Work on getting subscriber functioning to help do DB cleanup when sessions expire
/*
async function TestKey(){
    console.log('Test Key');
    await redisClient.set('testing', 'redis notify-keyspace-events : expired');
    await redisClient.expire('testing', 10);
}
*/

// Initialize database
db.initializeDatabase();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(session({
    name: 'opennms-data-scanner-session',
    genid: () => { return crypto.randomUUID(); },
    secret: 'opennms-data-scanner-secret',
    // create new redis store.
    store: new redisStore({
        host: 'localhost',
        port: 6379,
        client: redisClient,
        ttl: 300 // Session TTL in seconds
    }),
    cookie: {
        path: '/',
        httpOnly: true,
        secure: false,
        maxAge: 300 * 1000, // Session TTL in milliseconds
    },
    saveUninitialized: false,
    resave: false
}));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(stylus.middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Start redis components
startRedis().catch(err => {
    console.log('Redis start function catch all: ' + err);
});

// set express routers
app.use('/backend/login', loginBeRouter);
app.use('/backend/nodes', nodesBeRouter);
app.use('/backend/resources', resourcesBeRouter);
app.use('/frontend/index', indexFeRouter);
app.use('/frontend/login', loginFeRouter);

// Redirect to index page if no other route is specified
app.use(function(req, res, next) {
    res.redirect('/frontend/index');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('frontend/error');
});

process.on('beforeExit', () => {
    stopRedis();
});
process.on('crash', () => {
    stopRedis();

});

module.exports = {app: app, server: server};