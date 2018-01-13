const pg = require('pg');

async function connect() {
  let client = new pg.Client(process.env.DATABASE_URL || "postgres://localhost:5432/tradingBot");
  await client.connect();
  return client;
}

let exp = {};
// DataBase schema
// create table state(user_id int, coin varchar, state varchar, last_price decimal);
// insert into state(user_id, coin, state) values (0, 'BTC-USD', 'SELL');

async function getState(user_id) {
  let client = await connect();
  let res = await client.query(`SELECT state FROM states where user_id = ${user_id}`);
  client.end();
  return res.rows[0].state;
}
exp.getState = getState;

async function updateState(user_id, state) {
  let client = await connect();
  let res = await client.query(`UPDATE states SET state = '${state}' where user_id = ${user_id}`);
  return client.end();
}
exp.updateState = updateState;

async function getLastBoughtPrice(user_id, coin) {
  let client = await connect();
  let res = await client.query(`SELECT last_price FROM states where user_id = ${user_id} AND coin = '${coin}'`);
  client.end();
  return res.rows[0].last_price;
}
exp.getLastBoughtPrice = getLastBoughtPrice;

async function updateLastPrice(user_id, coin, price) {
  let client = await connect();
  let res = await client.query(`UPDATE states SET last_price = ${price} where user_id = ${user_id} AND coin = '${coin}'`);
  return client.end();
}
exp.updateLastPrice = updateLastPrice;

async function createUser(coin) {
  let client = await connect();
  let state = await client.query(`INSERT INTO states(coin, state) VALUES ('${coin}', 'SELL') RETURNING user_id`);
  let user_id = state.rows[0].user_id;
  return user_id;
}
exp.createUser = createUser;

async function getCoin(user_id) {
  let client = await connect();
  let res = await client.query(`SELECT coin FROM states where user_id = ${user_id}`);
  client.end();
  return res.rows[0].coin;
}
exp.getCoin = getCoin;

module.exports = exp;
