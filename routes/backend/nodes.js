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
        next(createError(401, 'Login required'));
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
            const nodes = response.data.node; // OpenNMS API v2 lables nodes as node regardless of the plural form in json format
            for (const node of nodes) {
                db.setSessionValue(req.session.id);
                db.insertNode(node.id, node.label, req.session.id)
            }
            res.redirect('/frontend/index');
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
    try {
        await Promise.all([fetchNodes(req, res, next)]);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
