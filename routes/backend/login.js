// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const axios = require('axios');
const createError = require('http-errors');
const express = require('express');
const router = express.Router();

// Login to OpenNMS
async function login(req, res, next) {
    if (req.session.auth === true) {
        console.log('Already logged in');
        console.log('SessionId: ' + req.session.id);
        res.send('Already logged in');
        return;
    }
    const options = {
        baseURL: 'http://' + req.body.server + ':' + req.body.port + '/opennms/rest/health',
        method: 'GET',
        auth: {
            username: req.body.username,
            password: req.body.password
        }
    };
    try {
        const response = await axios.request(options);
        if (response.status === 200 && response.statusText === 'OK') {
            if (response.data.healthy === true) {
                req.session.server = req.body.server;
                req.session.port = req.body.port;
                req.session.username = req.body.username;
                req.session.password = req.body.password;
                req.session.auth = true;
                res.redirect('/frontend/index');
            } else {
                next(createError(503, 'OpenNMS is not healthy'));
            }
        } else if (response.status === 401 && response.statusText === 'Unauthorized') {
            next(createError(401, 'Login failed'));

        } else {
            next(createError(500, 'Internal server error'));
        }
    } catch (error) {
        next(error);
    }
}

/* POST login information. */
router.post('/', async function(req, res, next) {
    if(!req.session.auth) {
        req.session.auth = false;
    }
    try {
        await Promise.all([login(req, res, next)]);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
