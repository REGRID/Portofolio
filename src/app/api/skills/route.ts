import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT id, name, category, level, icon
      FROM portfolio.skills
      ORDER BY category ASC, level DESC;
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
