// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/

// Define constants
const createError = require('http-errors');
const express = require('express');
const session = require('express-session');
const redis = require('redis');
const redisServer = require('redis-server');
const redisStore = require('connect-redis')(session);
const redisClient = redis.createClient({legacyMode: true}); // legacyMode: true is required for Redis v4+
const crypto = require('crypto');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const stylus = require('stylus');

// Define constants for routers - Server Side
const loginBeRouter = require('./routes/backend/login');

// Define constants for routers - Client Side
const indexFeRouter = require('./routes/frontend/index');
const loginFeRouter = require('./routes/frontend/login');

// Define express application
const app = express();

// Define app functions
async function startRedisServer() {
    // Start the redis server
    try {
        await redisserver.open();
        console.log('Redis server started');
    } catch (err) {
        throw new Error('Redis server failed to start' + err);
    }
}
async function startRedisClient() {
    // Start the redis client
    try {
        await redisClient.connect();
        console.log('Redis client started');
    } catch (err) {
        throw new Error('Redis client failed to start' + err);
    }
}

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Setup redis server for session storage
const redisserver = new redisServer({
    conf: './redis/conf/redis.conf',
    bin: './redis/bin/redis-server',
});

// Setup redis event loggers
redisserver.on('error', (err) => {
    console.log('Redis Server [ERROR]: ' + err);
});
redisClient.on('error', (err) => {
    console.log('Redis Client [ERROR]: ' + err);
});

// Start the redis server
startRedisServer();

// Continue with express setup
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

// Start the redis client
startRedisClient();

// set express routers
app.use('/backend/login', loginBeRouter);
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

module.exports = app;