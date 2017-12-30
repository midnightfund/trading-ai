const request = require('axios');
const {API_SECRET, API_KEY, PASSPHRASE} = require('./secrets.js');
const crypto = require('crypto');
const _ = require('lodash');

module.exports= {goingDown, goingUp, getState};

const swing = 0.005;

let state = 'SELL';
var lastAmmount = null;
let uptick = 0;
let downtick = 0;

const time = 90000

function goingDown(ogPrice, lastPrice = ogPrice, req) {
  return request(req)
  .then(async function(res) {
    let curPrice = Number.parseFloat(res.data.price);
    // console.log(`curPrice`, curPrice)
    if (curPrice / lastPrice <= 1) {
      if (uptick >= 0.25) uptick -= 0.25;
      // cut losses if we buy and it starts to drop
      if (state === 'BUY' && lastAmmount !== null && curPrice/lastAmmount < .99) {
        await sell(curPrice)
      }
      console.log(`down again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      return wait(time).then(() => goingDown(ogPrice, curPrice, req));
    } else {
      if (uptick <= 3.5) {
        console.log('uptick');
        uptick += 1
        return wait(time).then(() => goingDown(ogPrice, curPrice, req));
      } else {
        uptick = 0;
        if (state === 'SELL' && curPrice/ogPrice < 1 - swing) {
          await buy(curPrice);
        }
        return goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req)
      }
    }
  })
  .catch(e => {
    console.log('error', e)
  })
}

function goingUp(ogPrice, lastPrice = ogPrice, req) {
  return request(req)
  .then(async function(res) {
    let curPrice = Number.parseFloat(res.data.price);
    if (curPrice/ lastPrice >= 1) {
      if (downtick >= 0.25) downtick -= 0.25;
      console.log(`up again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
      return wait(time).then(() => goingUp(ogPrice, curPrice, req));
    } else {
      if (downtick <= 2) {
        console.log('downtick');
        downtick += 1
        return wait(time).then(() => goingUp(ogPrice, curPrice, req));
      } else {
        downtick = 0;
        // Sell when start going down and if the peak is more than what we bought for
        if (state === 'BUY' && curPrice/ogPrice >= 1.003) { // this is the fee of GDAX
          await sell(curPrice)
        }
        return goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req)
      }
    }
  })
  .catch(e => {
    console.log('error', e)
  })
}

function wait(num) {
  return new Promise((res, rej) => setTimeout(res, num));
}

function getState() {
  return state;
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
  return (await getAccountBalance('USD') / curPrice).toFixed(7);
}

async function buy(curPrice) {
  state = 'BUY';
  lastAmmount = curPrice;
  let amount = await getAmountToBuy(curPrice);
  console.log(`Bought ${amount} at ${curPrice}`);
  let body = {
    size: amount.toString(),
    price: curPrice.toString(),
    side: "buy",
    product_id: "BTC-USD"
  }
  let newReq = createRequest('POST', '/orders', body)
  console.log('newReq', newReq);
  return request(newReq);
}

async function sell(curPrice) {
  state = 'SELL';
  lastAmmount = null;
  console.log(`Sold ${await getAccountBalance('BTC')} at ${curPrice}`);
  let body = {
    "size": await getAccountBalance('BTC').toString(),
    "price": curPrice.toString(),
    "side": "sell",
    "product_id": "BTC-USD"
  }
  let newReq = createRequest('POST', '/orders', body)
  return request(newReq);
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
  if (body) req.body = body;
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



getCurPrice()
.then(r => {
  let curPrice = Number.parseFloat(r.data.price);
  console.log(curPrice);
  return buy(curPrice)
  .then(r => console.log('sold', r))
  .catch(e => console.log('error', e))
})

// getAccountBalance('USD')
// .then(r => console.log(r))

//////////////////////////////////
// let opts = {
//   method: 'POST',
//   url: 'https://httpbin.org/post',
//   body: {
//     this: 'thing'
//   }
// }
// const r = require('axios');
// r(opts)
//   .then(r => console.log('sold', r))
//   .catch(e => console.log('error', e))
