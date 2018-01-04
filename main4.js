const express = require('express');
const request = require('axios');
const bodyParser = require("body-parser");
const getCoin = require('./db2.js').getCoin;
const expect = require('chai').expect;
const bcrypt = require('bcrypt');
const {goingDown, goingUp, getCurrentState, createNewUser, buy, sell, getAccount} = require('./tools4');

const app = express();

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/*', async function(req, res, next) {
  let password = req.body.password;
  try {
    expect(password).to.not.be.empty;
  } catch (e) {
    res.send('No password found')
  }

  let ok = await bcrypt.compare(password, '$2a$09$aY.3W0zD7Ik5QaI.mvqWY.SOT2oheaImLgtzkgwJyds5VjeW1WlWC')
  .catch(e => {
    res.send("Error:", e)
  })
  ok ? next() : res.send('Password incorrect');
});

app.post('/buy/:id', async function(req, res) {
  let user_id = req.params.id
  let coin = await getCoin(user_id);
  let opts = {
    method: 'GET',
    url: `https://api.gdax.com/products/${coin}/ticker`,
    headers: {
      'User-Agent': 'express'
    }
  };

  request(opts)
    .then(async function(r) {
      await buy(r.data.price, user_id);
      let out = {user_id}
      res.send(JSON.stringify(out));
    })
    .catch(e => {
      console.log('error', e);
      res.send(e)
    })
});

app.post('/sell/:id', async function(req, res) {
  let user_id = req.params.id
  let coin = await getCoin(user_id);
  let opts = {
    method: 'GET',
    url: `https://api.gdax.com/products/${coin}/ticker`,
    headers: {
      'User-Agent': 'express'
    }
  };

  request(opts)
    .then(async function(r) {
      await sell(r.data.price, user_id);
      let out = {user_id}
      res.send(JSON.stringify(out));
    })
    .catch(e => {
      console.log('error', e);
      res.send(e)
    })
});

app.get('/products', (req, res) => {
  // request.get('https://sandbox-api.cobinhood.com/v1/market/currencies')
  let opts = {
    method: 'GET',
    url: 'https://api.gdax.com/products',
    headers: {
      'User-Agent': 'express'
    }
  }
  request(opts)
    .then(r => {
      res.send(r.data);
    })
    .catch(e => {
      console.log('err', e)
      res.send(400, e)
    })
})

app.post('/start/:id', (req, res) => {
  // request.get('https://sandbox-api.cobinhood.com/v1/market/currencies')
  let opts = {
    method: 'GET',
    url: `https://api.gdax.com/products/${req.params.id}/ticker`,
    headers: {
      'User-Agent': 'express'
    }
  };

  request(opts)
    .then(async function(r) {
      let user_id = await createNewUser(req.body, req.params.id);//secrets and coin
      r = r.data;
      goingUp(r.price, undefined, opts, user_id);
      let out = {user_id}
      res.send(JSON.stringify(out));
    })
    .catch(e => {
      console.log('error', e);
      res.send(e)
    })
})

app.post('/restart/:id', async function(req, res) {
  let user_id = req.params.id;
  let coin = await getCoin(user_id)
  let opts = {
    method: 'GET',
    url: `https://api.gdax.com/products/${coin}/ticker`,
    headers: {
      'User-Agent': 'express'
    }
  };
  request(opts)
    .then(function(r) {
      r = r.data;
      goingUp(r.price, undefined, opts, user_id);
      let out = {user_id}
      res.send(JSON.stringify(out));
    })
    .catch(e => {
      console.log('error', e);
      res.send(e)
    })
})

app.post('/account/:id', (req, res) => {
  getAccount()
  .then(r => {
    res.send(r.data)
  })
  .catch(e => {
    res.send(e.data)
  })
})

app.get('/*', (req, res) => {
  res.write('catch all route');
  res.end();
});
app.post('/*', (req, res) => {
  res.write('catch all route');
  res.end();
});

app.listen(5004, () => console.log('Listening on port 5004!'));
