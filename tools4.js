const request = require('axios');
// const {API_SECRET, API_KEY, PASSPHRASE} = require('./secrets.js');
const {getState, updateState, getLastBoughtPrice, updateLastPrice, createUser, getCoin} = require('./db2.js');
const expect = require('chai').expect;
const crypto = require('crypto');
const Base64 = require('js-base64').Base64;
const _ = require('lodash');

module.exports= {goingDown, goingUp, getCurrentState, changeState, createNewUser, buy, sell, getAccount, restartAll};

const swing = 0.005;

let upticks = {};
let downtick = 0;

const time = 900000

function goingDown(ogPrice, lastPrice = ogPrice, req, user_id) {
  return request(req)
  .then(async function(res) {
    // if bought then use that as the benchmark
    let lastAmmount = await getLastBoughtPrice(user_id, await getCoin(user_id));
    if (lastAmmount) ogPrice = lastAmmount;
    let curPrice = Number.parseFloat(res.data.price);

    // if current price is less then last ie; going down
    if (curPrice / lastPrice <= 1) {
      if (upticks[`user_${user_id}`] > 0) upticks[`user_${user_id}`] -= .5;
      console.log(`${user_id} down again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      // keeps going down so do all this again
      return wait(time).then(() => goingDown(ogPrice, curPrice, req, user_id));
    } else {
      // only buy if it hits the swing percent and then switch to the up side
      if (upticks[`user_${user_id}`] <= 1) {
        upticks[`user_${user_id}`] += 1;
      } else {
        upticks[`user_${user_id}`] = 0;
        console.log(`switch | ${await getState(user_id)} | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
        if (await getState(user_id) === 'SELL' && curPrice/ogPrice < 1) {
          await buy(curPrice, user_id);
        }
        return wait(300000).then(() => goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id))
      }
    }
  })
  .catch(e => {
    console.log('error', e)   //print and keep trying
    wait(300000).then(() => goingDown(ogPrice, lastPrice, req, user_id))
  })
}

function goingUp(ogPrice, lastPrice = ogPrice, req, user_id) {
  return request(req)
  .then(async function(res) {
    let lastAmmount = await getLastBoughtPrice(user_id, await getCoin(user_id));
    if (lastAmmount) ogPrice = lastAmmount;
    let curPrice = Number.parseFloat(res.data.price);
    if (curPrice/ lastPrice >= 1) {
      console.log(`up again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      return wait(300000).then(() => goingUp(ogPrice, curPrice, req, user_id));
    } else {
      console.log(`switch | ${await getState(user_id)} | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
      // Sell when start going down and if the peak is more than what we bought for
      if (await getState(user_id) === 'BUY' && curPrice/ogPrice >= 1.003) { // this is the fee of GDAX
        await sell(curPrice, user_id)
        return wait(time).then(() => goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id))
      } else if (getState(user_id) === 'BUY') {
        console.log(`up again buy: ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`)
        return wait(300000).then(() => goingUp(ogPrice, curPrice, req, user_id))
      } else {
        console.log(`up switch: ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`)
        return wait(time).then(() => goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id))
      }
    }
  })
  .catch(e => {
    console.log('error', e)//print and keep trying
    return wait(300000).then(() => goingUp(ogPrice, lastPrice, req, user_id))
  })
}

function wait(num) {
  return new Promise((res, rej) => setTimeout(res, num));
}

async function getCurrentState(user_id) {
  return await getState(user_id);
}

async function getAccountBalance(currency, user_id) {
  let res = await request(createRequest('GET', '/accounts', undefined, user_id));
  let usdBank = res.data.reduce((acc, cur) => {
    if (cur.currency.toUpperCase() === currency) acc = cur.balance;
    return acc;
  }, null)
  return usdBank;
}

async function getAmountToBuy(curPrice, user_id) {
  let balance = await getAccountBalance('USD', user_id)
  let balanceWithFee = balance - (balance * 0.0035);
  return (balanceWithFee / curPrice).toFixed(7);
}

async function buy(curPrice, user_id) {
  if (await getAccountBalance('USD', user_id) < 2) { return; }
  let amount = await getAmountToBuy(curPrice, user_id);
  let body = {
    size: amount.toString(),
    price: curPrice.toString(),
    side: "buy",
    product_id: await getCoin(user_id)
  }
  let newReq = createRequest('POST', '/orders', body, user_id)
  await request(newReq);
  console.log(`${user_id} Bought ${amount} at ${curPrice}`);
  await changeState(user_id);
  await updateLastPrice(user_id, await getCoin(user_id), curPrice)
  return;
}

async function sell(curPrice, user_id) {
  let size = await getAccountBalance((await getCoin(user_id)).split('-')[0], user_id);
  if (size < 0.000000) { return; } //Don't sell if we have nothing transfers take time
  let body = {
    "size": size.toString(),
    "price": curPrice.toString(),
    "side": "sell",
    "product_id": await getCoin(user_id)
  }
  let newReq = createRequest('POST', '/orders', body, user_id)
  await request(newReq);
  console.log(`${user_id} Sold ${size} at ${curPrice}`);
  await changeState(user_id)
  await updateLastPrice(user_id, await getCoin(user_id), null)
  return;
}

function signHeader(timestamp, method, requestPath, body, user_id) {
  let secret = getSecrets(user_id).API_SECRET;

  var what = timestamp + method + requestPath;
  if (body) {
    what += body;
  }
  // decode the base64 secret
  var key = Buffer(secret, 'base64');

  // create a sha256 hmac with the secret
  var hmac = crypto.createHmac('sha256', key);
  return hmac.update(what).digest('base64');
}

function createRequest(method, path, body, user_id) {
  const API_KEY = getSecrets(user_id).API_KEY;
  const PASSPHRASE = getSecrets(user_id).PASSPHRASE;
  if (body) body = JSON.stringify(body);
  let timestamp = Date.now() / 1000;
  method = method.toUpperCase();
  let req = {
    method: method,
    url: 'https://api.gdax.com' + path,
    headers: {
      'CB-ACCESS-KEY': API_KEY,
      'CB-ACCESS-PASSPHRASE': PASSPHRASE,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-SIGN': signHeader(timestamp, method, path, body, user_id),
      'User-Agent': 'express'
    }
  }
  if (body) req.data = JSON.parse(body);
  return req;
}

function getSecrets(user_id) {
  let encoded = process.env[`gdax_secrets_${user_id}`]
  let decoded = Base64.decode(encoded);

  let secs = decoded.split('<+>');
  return {API_KEY: secs[0], API_SECRET: secs[1], PASSPHRASE: secs[2]}
}

async function getCurPrice() {
  let opts = {
      method: 'GET',
      url: `https://api.gdax.com/products/BTC-USD/ticker`,
      headers: {
        'User-Agent': 'express'
      }
  };
  return request(opts)
}

async function changeState(user_id) {
  if (await getState(user_id) === 'BUY') {
    await updateState(user_id, 'SELL')
  } else {
    await updateState(user_id, 'BUY')
  }
  return await getState(user_id);
}

async function createNewUser(coin) {
  // expect(secrets).to.have.property('API_KEY');
  // expect(secrets).to.have.property('API_SECRET');
  // expect(secrets).to.have.property('API_PASSPHRASE');
  // let encryptedSecrets = encrypt()
  return await createUser(coin);
}

async function getAccount(id) {
  return request(createRequest('GET', '/accounts', undefined, id));
}

async function restartAll() {
  let user_ids = [1]; //only mine for now
  console.log(`Restarting users: ${user_ids}`);
  user_ids.map(async function(user_id) {
    let coin = await getCoin(user_id);
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
      })
      .catch(e => {
        console.log('error', e);
      })
  })
}
