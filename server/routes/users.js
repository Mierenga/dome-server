var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/on', function(req, res, next) {
  res.send('turning on');
});

/* GET users listing. */
router.get('/off', function(req, res, next) {
  res.send('turning off');
});

module.exports = router;
