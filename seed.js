const pg = require('pg');

async function main() {
  let client = new pg.Client(process.env.DATABASE_URL);
  await client.connect();
  await client.query(`CREATE TABLE IF NOT EXISTS states(user_id SERIAL, coin varchar, state varchar, last_price decimal)`);
  await client.end();
}

main();
