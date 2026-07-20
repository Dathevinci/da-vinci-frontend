import { NextResponse } from 'next/server';
import { homeShelves } from '@/lib/novel/sources';

// Home shelves for Novels mode — readnovelfull lists + a fanmtl shelf.
export async function GET() {
  try {
    return NextResponse.json(await homeShelves());
  } catch (error: any) {
    console.error('Novel Home API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
