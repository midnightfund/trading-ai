const request = require('request-promise');


module.exports= {goingDown, goingUp, getBank, getState};

let state = 'SELL';
let bank = 500;
var lastAmmount = null;
let uptick = 0;
let ammountBought = 0;

const time = 900000

function goingDown(ogPrice, lastPrice = ogPrice, req) {
  // console.log('hit', ogPrice, lastPrice);
  return request(req)
    .then(res => {
      let curPrice = JSON.parse(res).price;
      if (curPrice / lastPrice <= 1) {
        console.log(`down again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
        return wait(time).then(() => goingDown(ogPrice, curPrice, req));
      } else {
        // if (uptick <= 1) {
        //   uptick += 1;
        //   return wait(time).then(() => goingDown(ogPrice, curPrice, req));
        // } else {
          // uptick = 0;
          if (state === 'SELL' && curPrice/ogPrice < 1) {
            state = 'BUY';
            ammountBought = bank / curPrice;
            curPrice = Number.parseFloat(curPrice);
            lastAmmount = curPrice;
            bank -= (curPrice * ammountBought);
            console.log('BUY: ', bank);
          }
          console.log(`down switch: lastAmmount=${lastAmmount} | bank= ${bank} | curPrice=${curPrice}`)
          return wait(300000).then(() => goingUp(lastAmmount !== null ? lastAmmount : curPrice, undefined, req))
        // }
      }
    })
    .catch(e => {
      console.log('error', e)
    })
}

function goingUp(ogPrice, lastPrice = ogPrice, req) {
  return request(req)
    .then(res => {
      let curPrice = JSON.parse(res).price;
      if (curPrice/ lastPrice >= 1) {
        console.log(`up again | ogPrice: ${ogPrice} | curPrice: ${curPrice} | lastPrice: ${lastPrice}`);
        return wait(300000).then(() => goingUp(ogPrice, curPrice, req));
      } else {
        if (state === 'BUY' && curPrice/ogPrice >= 1.003) {
          state = 'SELL';
          curPrice = Number.parseFloat(curPrice);
          lastAmmount = null;
          bank += (curPrice * ammountBought);
          console.log('SELL: ', bank)
          console.log(`up switch: lastAmmount=${lastAmmount} | bank= ${bank} | curPrice=${curPrice}`)
          return wait(time).then(() => goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req))
        } else if (state === 'BUY') {
          console.log(`up again buy: lastAmmount=${lastAmmount} | bank= ${bank} | curPrice=${curPrice}`)
          return wait(300000).then(() => goingUp(ogPrice, curPrice, req))
        } else {
          console.log(`up switch: lastAmmount=${lastAmmount} | bank= ${bank} | curPrice=${curPrice}`)
          return wait(time).then(() => goingDown(lastAmmount !== null ? lastAmmount : curPrice, undefined, req))
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
