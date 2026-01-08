import { MongoClient } from 'mongodb';

function requireEnv(name: 'MONGODB_URI') {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const dbName = process.env.MONGODB_DB || 'memory_viewer';

let clientPromise: Promise<MongoClient> | null = null;

export async function getDb() {
  if (!clientPromise) {
    const client = new MongoClient(requireEnv('MONGODB_URI'));
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db(dbName);
}
