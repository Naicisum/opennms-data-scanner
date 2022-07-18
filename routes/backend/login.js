// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const express = require('express');
const router = express.Router();
const axios = require('axios');

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
                req.session.username = req.body.username;
                req.session.password = req.body.password;
                req.session.auth = true;
                res.status(200).send('Login successful');
            } else {
                res.status(503).send('Service unavailable');
            }
        } else if (response.status === 401 && response.statusText === 'Unauthorized') {
            res.status(401).send('Login failed');
        } else {
            res.status(500).send('Internal server error');
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

    console.log('SessionId: ' + req.session.id);
    console.log('Username:  ' + req.session.username);
    console.log('Password:  ' + req.session.password);
    console.log('Auth:      ' + req.session.auth);
});

module.exports = router;
