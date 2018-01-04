(async function() {
  const pg = require('pg');
  let client = new pg.Client('postgres://localhost:5432/tradingBot');
  await client.connect();
  // await client.query(`create table state(user_id SERIAL, coin varchar, state varchar, last_price decimal)`);
  await client.query(`INSERT INTO states(coin, state) VALUES ('things', 'SELL')`);
  await client.end();
})();
