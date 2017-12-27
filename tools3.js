const request = require('request-promise');
const db = require('./db.js');

module.exports= {goingDown, goingUp, getBank, getState};

const swing = 0.000001;

let uptick = 0;
let downtick = 0;

const time = 90000

async function goingDown(ogPrice, lastPrice = ogPrice, userId, req) {
  let lastAmmount = await db.getLastPrice(userId)
  return request(req)
    .then(async function(res) {
      let curPrice = JSON.parse(res).price;
      // console.log(`curPrice`, curPrice)
      if (curPrice / lastPrice <= 1) {
        if (uptick >= 0.25) uptick -= 0.25;
        if (await db.getState(userId) === 'BUY' && lastAmmount !== null && curPrice/lastAmmount < .99) {
          db.updateState(userId, 'SELL');
          curPrice = Number.parseFloat(curPrice);
          db.updateLastPrice(userId, curPrice);
          db.updateBank(userId, curPrice * db.getCoinAmmount(userId))
          db.updateCoinAmmount(userId, 0)
        }
        console.log(`down again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
        return wait(time).then(() => goingDown(ogPrice, curPrice, userId, req));
      } else {
        if (uptick <= 3.5) {
          console.log('uptick');
          uptick += 1
          return wait(time).then(() => goingDown(ogPrice, curPrice, userId, req));
        } else {
          if (await db.getState(userId) === 'SELL' && curPrice/ogPrice < 1 - swing) {
            db.updateState(userId, 'BUY')
            db.updateCoinAmmount(userId, await db.getBank(userId) / curPrice)
            // console.log(`Buy here | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`)
            // console.log('Buy', curPrice);
            curPrice = Number.parseFloat(curPrice);
            db.updateLastPrice(userId, curPrice);
            db.updateBank(userId, await db.getBank(userId) - (curPrice * await db.getCoinAmmount(userId)))
          } else {
            console.log('going up ', curPrice);
          }
          console.log('lastAmmount: ', lastAmmount)
          return goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, userId, req)
        }
      }
    })
    .catch(e => {
        // console.log('error', e)
    })
}

async function goingUp(ogPrice, lastPrice = ogPrice, userId, req) {
  let lastAmmount = await db.getLastPrice(userId)
  return request(req)
    .then(async function(res) {
      let curPrice = JSON.parse(res).price;
      if (curPrice/ lastPrice >= 1) {
        if (downtick >= 0.25) downtick -= 0.25;
        console.log(`up again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
        return wait(time).then(() => goingUp(ogPrice, curPrice, userId, req));
      } else {
        if (downtick <= 2) {
          console.log('downtick');
          downtick += 1
          return wait(time).then(() => goingUp(ogPrice, curPrice, userId, req));
        } else {
          if (await db.getState(userId) === 'BUY' && curPrice/ogPrice >= 1) {
            db.updateState(userId, 'SELL');
            db.updateCoinAmmount(userId, 0);
            // console.log('Sell', curPrice);
            curPrice = Number.parseFloat(curPrice);
            db.updateLastPrice(userId, curPrice);
            db.updateBank(userId, await db.getBank(userId) + (curPrice * await db.getCoinAmmount(userId)));
            db.updateCoinAmmount(userId, 0);
          } else {
            console.log('going down', curPrice, ogPrice);
          }
          console.log('lastAmmount: ', lastAmmount)
          return goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, userId, req)
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

async function getBank() {
  return await db.getBank(userId).toString();
}
async function getState() {
  return await db.getState(0);
}
