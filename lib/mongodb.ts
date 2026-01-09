import { MongoClient } from 'mongodb';

function requireEnv(name: 'MONGODB_URI') {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function describeMongoTarget(uri: string) {
  const s = uri.trim();
  const schemeMatch = /^(mongodb(?:\+srv)?):\/\//i.exec(s);
  const scheme = schemeMatch ? schemeMatch[1] : 'mongodb';
  const withoutScheme = s.replace(/^(mongodb(?:\+srv)?):\/\//i, '');
  const afterCreds = withoutScheme.includes('@') ? withoutScheme.split('@').slice(1).join('@') : withoutScheme;
  const hostPort = afterCreds.split(/[/?]/)[0] || '';
  return `${scheme}://${hostPort}`;
}

const dbName = process.env.MONGODB_DB || 'memory_viewer';

let clientPromise: Promise<MongoClient> | null = null;

export async function getDb() {
  if (!clientPromise) {
    const uri = requireEnv('MONGODB_URI');
    const client = new MongoClient(uri);
    clientPromise = client.connect().catch((e: any) => {
      throw new Error(`Mongo connect failed (${describeMongoTarget(uri)}): ${String(e?.message || e)}`);
    });
  }
  const client = await clientPromise;
  return client.db(dbName);
}
