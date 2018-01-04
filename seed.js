const pg = require('pg');

async function main() {
  let client = new pg.Client('postgres://localhost:5432/tradingBot');
  await client.connect();
  await client.query(`create table states(user_id SERIAL, coin varchar, state varchar, last_price decimal)`);
  await client.end();
}

main();
