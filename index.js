const express = require('express');
const app = express();

app.get('/api/test', (req, res) => {
    res.json({ message: 'OK' });
});

module.exports = app;
exports.default = app;