// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const createError = require('http-errors');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../../lib/common/database');

// Fetch OpenNMS Nodes
async function fetchMeasurements(req, res, next) {
    if (req.session.auth === undefined || req.session?.auth === false) {
        //next(createError(401, 'Login required'));
        console.log('Measurements error: Login required');
    }
    
    try {
        let currentNodeId = -1;
        let currentResourceId = "";
        let currentAttributeId = "";

        await db.setResultsSummaryValue(req.session.id, 0, 0, 0, 0, 'Scan Initiated');
        
        const nodeIds = await Promise.all([db.getNodes(req.session.id)]).catch(error => {
            //next(error);
            console.log('Measurements error: ' + error);
        });

        await db.setResultsSummaryValue(req.session.id, 0, nodeIds[0].length, 0, 0, 'Total Nodes');
        
        for (const nodeId of nodeIds[0]) {
            const resources = await Promise.all([db.getResources(req.session.id, nodeId)])
                                           .catch(error => { /* next(error); */ console.log('Measurements error: ' + error); });

            if (resources[0] === null) { continue; }

            await db.incrementResourcetotalInSummary(req.session.id, resources[0].length);
            await db.setStatusInSummary(req.session.id, 'Scan Started - (' + nodeId + ')');

            for (const resource of resources[0]) {
                await db.setResultsDetailValue(req.session.id, resource.nodeId, resource.resourceId, resource.attributeId, 0, 0, 'Initializing' + ' (' + resource.resourceId + ':' + resource.attributeId + ')');
                const options = {
                    baseURL: 'http://' + req.session.server + ':' + req.session.port +
                        '/opennms/rest/measurements/' + resource.resourceId + '/' + resource.attributeId +
                        '?start=-3600000&step=60000&aggregation=AVERAGE',
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
                    let valid_count = 0;
                    let invalid_count = 0;

                    const metrics = response.data.columns[0].values;
                    for (const metric of metrics) {
                        // check if the element is a valid number using ternary operator
                        // and increment appropriately
                        (isNaN(metric)) ? invalid_count++ : valid_count++;
                    }

                    if (currentNodeId !== resource.nodeId) {
                        currentNodeId = resource.nodeId;
                        await db.incrementNodecountInSummary(req.session.id);
                    }
                    if (currentResourceId !== resource.resourceId || currentAttributeId !== resource.attributeId) {
                        currentResourceId = resource.resourceId;
                        currentAttributeId = resource.attributeId;
                        await db.incrementResourcecountInSummary(req.session.id);
                    }

                    await db.setResultsDetailValue(req.session.id, resource.nodeId, resource.resourceId, resource.attributeId, valid_count, invalid_count, 'Finished' + ' (' + resource.resourceId + ':' + resource.attributeId + ')');
                } else if (response.status === 401 && response.statusText === 'Unauthorized') {
                    await db.setResultsDetailValue(req.session.id, resource.nodeId, resource.resourceId, resource.attributeId, 0, 0, 'Unauthorized');
                    //next(createError(401, 'Login failed'));
                    console.log("Measurement error: " + response.statusText);
                } else {
                    await db.setResultsDetailValue(req.session.id, resource.nodeId, resource.resourceId, resource.attributeId, 0, 0, 'Failed');
                    //next(createError(500, 'Internal server error'));
                    console.log("Measurement error: " + response.status + " " + response.statusText);
                }
            }
            await db.setStatusInSummary(req.session.id, 'Scan Ended - (' + nodeId + ')');
        }
        await db.setStatusInSummary(req.session.id, 'Scan Completed');
    } catch (error) {
        //next(createError(500, 'Internal server error'));
        console.log('Measurements error: ' + error);
    }
}

/* POST login information. */
router.post('/', async function(req, res, next) {
    try {
        await fetchMeasurements(req, res, next);
        res.redirect('back');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
