import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const requiredVersion = (process.env.REQUIRED_CLIENT_VERSION || '').trim();
  const apkUrl = (process.env.REQUIRED_CLIENT_APK_URL || '').trim();

  return NextResponse.json({
    requiredVersion: requiredVersion || null,
    apkUrl: apkUrl || null
  });
}
