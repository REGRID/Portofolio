import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(`
      SELECT 
        id, 
        title, 
        slug, 
        client, 
        category, 
        video_url, 
        thumbnail_url, 
        duration, 
        year, 
        description, 
        tags, 
        featured, 
        created_at
      FROM portfolio.projects
      ORDER BY featured DESC, id ASC;
    `);
    return NextResponse.json({ success: true, data: res.rows });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
