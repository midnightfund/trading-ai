const pg = require('pg');

async function connect() {
  let client = new pg.Client("postgres://localhost:5432/tradingBot");
  await client.connect();
  return client;
}

let exp = {};

//
//   // await client.query("INSERT INTO state(coin, buy, sell, lastprice, coin_ammount) values($1, $2, $3, $4, $5)", ['fakeCoin', false, false, 100.01, 1.00])
//
//   let res = await client.query("SELECT * FROM state")
//   console.log('resss', res.rows);


async function coinExists (coin) {
  let client = await connect();

  let res = await client.query(`SELECT coin FROM state WHERE coin = ${coin}`)
  client.end()
  return res.rowCount > 0;
}
exp.coinExists = coinExists;

async function resetCoin(coin) {
  let client = await connect();
  await client.query(`UPDATE state SET buy = false, sell = true, lastPrice = null, coin_ammount = 0 where coin = '${coin}'`)
  return await client.end();
}
exp.resetCoin = resetCoin;

async function updateBank(id, ammount) {
  let client = await connect();
  await client.query(`UPDATE bank SET ammount = ${ammount} where id = ${id}`)
  return await client.end();
}
exp.updateBank = updateBank;

async function getBank(id) {
  let client = await connect();
  let res = await client.query(`SELECT ammount from bank where id = ${id}`);
  client.end()
  return res.rows[0].ammount;
}
exp.getBank = getBank;

async function setUser(id, coin) {
  let client = await connect();
  let res = await client.query(`insert into users (id, coin) values (${id}, '${coin}')`);
  return client.end();
}
exp.setUser = setUser;

async function updateCoinAmmount(id, ammount) {
  let client = await connect();
  await client.query(`UPDATE state SET coin_ammount = ${ammount} where user_id = ${id}`)
  return await client.end();
}
exp.updateCoinAmmount = updateCoinAmmount;

async function updateState(id, state) {
  let buy, sell;
  buy = state === 'BUY';
  sell = !buy;
  let client = await connect();
  await client.query(`UPDATE state SET buy = ${buy}, sell = ${sell} where user_id = ${id}`)
  return await client.end();
}
exp.updateState = updateState;

async function getState(id) {
  let client = await connect();
  let res = await client.query(`SELECT buy from state where user_id = ${id}`);
  client.end()
  return res.rows[0].buy === true ? 'BUY' : 'SELL';
}
exp.getState = getState;

async function getCoinAmmount(id) {
  let client = await connect();
  let res = await client.query(`SELECT coin_ammount from state where user_id = ${id}`);
  client.end()
  return res.rows[0].coin_ammount;
}
exp.getCoinAmmount = getCoinAmmount;

async function updateLastPrice(id, price) {
  let client = await connect();
  let res = await client.query(`UPDATE state SET lastprice = ${price} where user_id = ${id}`);
  return client.end()
}
exp.updateLastPrice = updateLastPrice;

async function getLastPrice(id) {
  let client = await connect();
  let res = await client.query(`SELECT lastprice from state where user_id = ${id}`);
  client.end()
  return res.rows[0].lastprice;
}
exp.getLastPrice = getLastPrice;

module.exports = exp;
