// Enable Strict Mode; Ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
'use strict';

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "next" }]*/
const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('frontend/index', { title: 'OpenNMS Data Scanner', sessionID: req.sessionID, sessionExpireTime: req.session.cookie.expires/1000 });
});

module.exports = router;
