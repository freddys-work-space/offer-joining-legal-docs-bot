const { Pool } = require('pg');
const dns = require('dns');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendEnv = path.resolve(__dirname, '../.env');
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config({ path: rootEnv });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn(
    '[DB] WARNING: DATABASE_URL is not set in .env. Database operations will fail until you add your Neon connection string.'
  );
}

function resolveHostFallback(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (!err && address) return resolve(address);
      const resolver = new dns.Resolver();
      resolver.setServers(['8.8.8.8', '1.1.1.1']);
      resolver.resolve4(hostname, (rErr, addresses) => {
        if (rErr || !addresses || addresses.length === 0) {
          return reject(err || rErr || new Error(`Unable to resolve ${hostname}`));
        }
        resolve(addresses[0]);
      });
    });
  });
}

let poolPromise = null;

async function getPool() {
  if (!connectionString) {
    const err = new Error('Database not configured: please set DATABASE_URL in .env');
    err.statusCode = 503;
    throw err;
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      const url = new URL(connectionString);
      const originalHost = url.hostname;
      const isLocal = originalHost === 'localhost' || originalHost === '127.0.0.1';
      const resolvedHost = isLocal ? originalHost : await resolveHostFallback(originalHost);

      return new Pool({
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        host: resolvedHost,
        port: Number(url.port || 5432),
        database: url.pathname.replace(/^\//, ''),
        ssl: isLocal
          ? false
          : {
              rejectUnauthorized: false,
              servername: originalHost,
            },
      });
    })();
  }

  return poolPromise;
}

async function query(text, params) {
  const p = await getPool();
  return p.query(text, params);
}

module.exports = { getPool, query };
