const request = require('request-promise');


module.exports= {goingDown, goingUp, getBank, getState};

const swing = 0.005;

let state = 'SELL';
let bank = 500;
var lastAmmount = null;
let uptick = 0;
let downtick = 0;
let ammountBought = 0;

const time = 90000

function goingDown(ogPrice, lastPrice = ogPrice, req) {
    // console.log('hit', ogPrice, lastPrice);
    return request(req)
        .then(res => {
            let curPrice = JSON.parse(res).price;
            // console.log(`curPrice`, curPrice)
            if (curPrice / lastPrice <= 1) {
              if (uptick >= 0.25) uptick -= 0.25;
              if (state === 'BUY' && lastAmmount !== null && curPrice/lastAmmount < .99) {
                state = 'SELL';
                curPrice = Number.parseFloat(curPrice);
                lastAmmount = null;
                bank += (curPrice * ammountBought);
                console.log('SELL: ', bank)
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
                  state = 'BUY';
                  ammountBought = bank / curPrice;
                  // console.log(`Buy here | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`)
                  // console.log('Buy', curPrice);
                  curPrice = Number.parseFloat(curPrice);
                  lastAmmount = curPrice;
                  bank -= (curPrice * ammountBought);
                  console.log('BUY: ', bank);
                } else {
                  console.log('going up ', curPrice);
                }
                console.log('lastAmmount: ', lastAmmount)
                return goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req)
              }

            }
        })
        .catch(e => {
            // console.log('error', e)
        })
}

function goingUp(ogPrice, lastPrice = ogPrice, req) {
    return request(req)
        .then(res => {
            let curPrice = JSON.parse(res).price;
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
                  if (state === 'BUY' && curPrice/ogPrice >= 1.003) {
                      state = 'SELL';
                      // console.log('Sell', curPrice);
                      curPrice = Number.parseFloat(curPrice);
                      lastAmmount = null;
                      bank += (curPrice * ammountBought);
                      console.log('SELL: ', bank)
                  } else {
                      console.log('going down', curPrice, ogPrice);
                  }
                  console.log('lastAmmount: ', lastAmmount)
                  return goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req)
                }

            }
        })
        .catch(e => {
            console.log('error', e.body)
        })
}

function wait(num) {
    return new Promise((res, rej) => setTimeout(res, num));
}

function getBank() {
    return bank.toString();
}
function getState() {
  return state;
}
