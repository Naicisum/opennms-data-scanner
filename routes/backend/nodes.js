// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../lib/common/database');

// Fetch OpenNMS Nodes
async function fetchNodes(req, res, next) {
    if (req.session.auth === undefined || req.session?.auth === false) {
        //next(createError(401, 'Login required'));
        console.log('Nodes Error: Login required');
        return;
    }
    const options = {
        baseURL: 'http://' + req.session.server + ':' + req.session.port + '/opennms/api/v2/nodes',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        auth: {
            username: req.session.username,
            password: req.session.password
        }
    };
    try {
        const response = await axios.request(options);
        if (response.status === 200 && response.statusText === 'OK') {
            const nodes = response.data.node; // OpenNMS API v2 labels nodes as node regardless of the plural form in json format
            for (const node of nodes) {
                db.insertNode(req.session.id, node.id, node.label)
            }
        } else if (response.status === 401 && response.statusText === 'Unauthorized') {
            //next(createError(401, 'Login failed'));
            console.log('Nodes error: Login failed');
        } else {
            //next(createError(500, 'Internal server error'));
            console.log('Nodes error: ' + response.statusText);
        }
    } catch (error) {
        next(error);
    }
}

/* POST login information. */
router.post('/', async function(req, res, next) {
    try {
        await fetchNodes(req, res, next);
        res.redirect('back');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
