const request = require('request-promise');
const express = require('express');
const app = express();

//https://api.coinbase.com/v2/currencies
let cobinhoodReq = {
  method: 'GET',
  uri: `https://api.gdax.com/products/BTC-USD/ticker`,
  headers: {
    'User-Agent': 'express'
  }
};

let coinbaseReq = {
  method: 'GET',
  uri: `https://api.coinbase.com/v2/prices/BTC-USD/buy`
}

async function main () {
  await getAndBuyCobinhood();
  await new Promise((resolve, reject) => setTimeout(resolve, 5000))
  await getAndSellCoinbase()
  await new Promise((resolve, reject) => setTimeout(resolve, 5000))
  main();
}

let bank = 500;
let coinAmount = 0;

async function getAndSellCoinbase() {
  let curPrice = parseFloat(JSON.parse(await request(coinbaseReq)).data.amount);
  console.log('sell');
  console.log('curPrice', curPrice);
  console.log('coinAmount', coinAmount);
  bank += (curPrice * coinAmount);
  console.log('bank', bank);
  coinAmount = 0;
  return;
}

async function getAndBuyCobinhood() {
  let curPrice = parseFloat(JSON.parse(await request(cobinhoodReq)).price);
  coinAmount = bank/curPrice;
  console.log('buy');
  console.log('curPrice', curPrice);
  console.log('coinAmount', coinAmount);
  bank -= curPrice * coinAmount
  console.log('bank', bank);
  return;
}



app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/bank', (req, res) => {
  res.send(bank.toString())
});

app.listen(5003, () => {
  main();
  console.log('Listening on port 5003!')
});
