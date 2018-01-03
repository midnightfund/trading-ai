const request = require('axios');
const {API_SECRET, API_KEY, PASSPHRASE} = require('./secrets.js');
const {getState, updateState, getLastBoughtPrice, updateLastPrice, createUser, getCoin} = require('./db2.js');
const expect = require('chai').expect;
const crypto = require('crypto');
const _ = require('lodash');

module.exports= {goingDown, goingUp, getCurrentState, changeState, createNewUser, buy, sell};

const swing = 0.005;

let uptick = 0;
let downtick = 0;

const time = 60000

function goingDown(ogPrice, lastPrice = ogPrice, req, user_id) {
  return request(req)
  .then(async function(res) {
    let lastAmmount = await getLastBoughtPrice(user_id, await getCoin(user_id));
    if (lastAmmount) ogPrice = lastAmmount;
    let curPrice = Number.parseFloat(res.data.price);
    // console.log(`curPrice`, curPrice)
    if (curPrice / lastPrice <= 1) {
      if (uptick >= 0.25) uptick -= 0.25;
      // cut losses if we buy and it starts to drop
      if (await getState(user_id) === 'BUY' && lastAmmount !== null && curPrice/lastAmmount < .97) {
        await sell(curPrice, user_id)
      }
      console.log(`down again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      return wait(time).then(() => goingDown(ogPrice, curPrice, req, user_id));
    } else {
      if (uptick > 0.75 && await getState(user_id) === 'SELL' && curPrice/ogPrice < 1 - 0.0085) {
        await buy(curPrice, user_id);
        return goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id)
      } else if (uptick <= 3.5) {
        console.log('uptick - ', curPrice);
        if (curPrice > ogPrice) {
          console.log(`flip | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
          return wait(time).then(() => goingUp(ogPrice, curPrice, req, user_id));
        } else {
          uptick += 1
          return wait(time).then(() => goingDown(ogPrice, curPrice, req, user_id));
        }
      } else {
        console.log(`switch | ${await getState(user_id)} | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
        uptick = 0;
        if (await getState(user_id) === 'SELL' && curPrice/ogPrice < 1 - swing) {
          await buy(curPrice, user_id);
        }
        return goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id)
      }
    }
  })
  .catch(e => {
    console.log('error', e)//print and keep trying
    wait(time).then(() => goingDown(ogPrice, lastPrice, req, user_id))
  })
}

function goingUp(ogPrice, lastPrice = ogPrice, req, user_id) {
  return request(req)
  .then(async function(res) {
    let lastAmmount = await getLastBoughtPrice(user_id, await getCoin(user_id));
    if (lastAmmount) ogPrice = lastAmmount;
    let curPrice = Number.parseFloat(res.data.price);
    if (curPrice/ lastPrice >= 1) {
      if (downtick >= 0.25) downtick -= 0.25;
      console.log(`up again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      return wait(time).then(() => goingUp(ogPrice, curPrice, req, user_id));
    } else {
      if (downtick > 0.75 && await getState(user_id) === 'BUY' && curPrice/ogPrice >= 1.0085) {
        await sell(curPrice, user_id)
        return goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id)
      } else if (downtick <= 3.5) {
        console.log('downtick - ', curPrice);
        if (curPrice < ogPrice) {
          console.log(`flip | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
          return wait(time).then(() => goingDown(ogPrice, curPrice, req, user_id));
        } else {
          downtick += 1
          return wait(time).then(() => goingUp(ogPrice, curPrice, req, user_id));
        }
      } else {
        console.log(`switch | ${await getState(user_id)} | curPrice: ${curPrice} | ogPrice: ${ogPrice}`);
        downtick = 0;
        // Sell when start going down and if the peak is more than what we bought for
        if (await getState(user_id) === 'BUY' && curPrice/ogPrice >= 1.003) { // this is the fee of GDAX
          await sell(curPrice, user_id)
        }
        return goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req, user_id)
      }
    }
  })
  .catch(e => {
    console.log('error', e)//print and keep trying
    return wait(time).then(() => goingUp(ogPrice, lastPrice, req, user_id))
  })
}

function wait(num) {
  return new Promise((res, rej) => setTimeout(res, num));
}

async function getCurrentState(user_id) {
  return await getState(user_id);
}

async function getAccountBalance(currency) {
  let res = await request(createRequest('GET', '/accounts'));
  let usdBank = res.data.reduce((acc, cur) => {
    if (cur.currency.toUpperCase() === currency) acc = cur.balance;
    return acc;
  }, null)
  return usdBank;
}

async function getAmountToBuy(curPrice) {
  let balance = await getAccountBalance('USD')
  let balanceWithFee = balance - (balance * 0.0035);
  return (balanceWithFee / curPrice).toFixed(7);
}

async function buy(curPrice, user_id) {
  if (await getAccountBalance('USD') < 2) { return; }
  let amount = await getAmountToBuy(curPrice);
  let body = {
    size: amount.toString(),
    price: curPrice.toString(),
    side: "buy",
    product_id: await getCoin(user_id)
  }
  let newReq = createRequest('POST', '/orders', body)
  await request(newReq);
  console.log(`Bought ${amount} at ${curPrice}`);
  await changeState(user_id);
  await updateLastPrice(user_id, await getCoin(user_id), curPrice)
  return;
}

async function sell(curPrice, user_id) {
  let size = await getAccountBalance((await getCoin(user_id)).split('-')[0]);
  if (size < 0.000000) { return; } //Don't sell if we have nothing transfers take time
  let body = {
    "size": size.toString(),
    "price": curPrice.toString(),
    "side": "sell",
    "product_id": await getCoin(user_id)
  }
  let newReq = createRequest('POST', '/orders', body)
  await request(newReq);
  console.log(`Sold ${size} at ${curPrice}`);
  await changeState(user_id)
  await updateLastPrice(user_id, await getCoin(user_id), null)
  return;
}

function signHeader(timestamp, method, requestPath, body) {
  let secret = API_SECRET;

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

function createRequest(method, path, body) {
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
      'CB-ACCESS-SIGN': signHeader(timestamp, method, path, body),
      'User-Agent': 'express'
    }
  }
  if (body) req.data = JSON.parse(body);
  return req;
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

async function createNewUser(secrets, coin) {
  expect(secrets).to.have.property('API_KEY');
  expect(secrets).to.have.property('API_SECRET');
  expect(secrets).to.have.property('API_PASSPHRASE');
  // let encryptedSecrets = encrypt()
  return await createUser(secrets, coin);
}
