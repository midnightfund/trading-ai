const express = require('express');
const request = require('request-promise');
const {goingDown, goingUp, getBank, getState} = require('./tools');

const app = express();

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/bank', (req, res) => {
    res.send(getBank())
});
app.get('/state', (req, res) => {
    res.send(getState())
});

app.get('/products', (req, res) => {
    // request.get('https://sandbox-api.cobinhood.com/v1/market/currencies')
    let opts = {
        method: 'GET',
        uri: 'https://api.gdax.com/products',
        headers: {
            'User-Agent': 'express'
        }
    }
    request(opts)
        .then(r => {
            console.log('sandbox res: ', r);

            res.send(JSON.parse(r));
        })
        .catch(e => {
            console.log('err', e)
            res.send(400, e)
        })
})

app.get('/products/:id', (req, res) => {
    // request.get('https://sandbox-api.cobinhood.com/v1/market/currencies')
    let opts = {
        method: 'GET',
        uri: `https://api.gdax.com/products/${req.params.id}/ticker`,
        headers: {
            'User-Agent': 'express'
        }
    };

    request(opts)
        .then(r => {
            r = JSON.parse(r);
            // goingDown(r.price, undefined, opts);
            goingUp(r.price, undefined, opts);
            res.send(r);
        })
        .catch(e => {
            res.send(e)
        })
})

app.get('/*', (req, res) => {
    res.write('catch all route');
    res.end();
});

app.listen(5000, () => console.log('Listening on port 5000!'));
