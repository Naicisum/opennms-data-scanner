// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../lib/common/database');

// Fetch OpenNMS Resources
async function fetchResources(req, res, next) {
    if (req.session.auth === undefined || req.session?.auth === false) {
        next(createError(401, 'Login required'));
    }

    const nodeIds = await Promise.all([db.getNodeIds(req.session.id)]).catch(error => {
        next(error);
    });

    try {
        for (const nodeId of nodeIds[0]) {
            const options = {
                baseURL: 'http://' + req.session.server + ':' + req.session.port + '/opennms/rest/resources/fornode/' + nodeId,
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                auth: {
                    username: req.session.username,
                    password: req.session.password
                }
            };

            const response = await axios.request(options);
            if (response.status === 200 && response.statusText === 'OK') {
                const resources = response.data.children.resource; // Contains array of resources even though it's named resource
                for (const resource of resources) {
                    const attributes = resource.rrdGraphAttributes;
                    for (const attribute of Object.values(attributes)) {
                        db.insertResource(nodeId, resource.id, attribute.name);
                    }
                }
            } else if (response.status === 401 && response.statusText === 'Unauthorized') {
                next(createError(401, 'Login failed'));
            } else {
                next(createError(500, 'Internal server error'));
            }
        }
        res.redirect('/frontend/index');
    } catch (error) {
        console.log('Resources error: ' + error);
        next(createError(500, 'Internal server error'));
    }

}

/* POST login information. */
router.post('/', async function(req, res, next) {
    try {
        await Promise.all([fetchResources(req, res, next)]);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
