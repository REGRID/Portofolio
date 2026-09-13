import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const timeRes = await query('SELECT NOW() as now, version() as version, current_schema() as schema;');
    const tablesRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1;
    `, [process.env.DB_SCHEMA || 'portfolio']);

    return NextResponse.json({
      status: 'connected',
      service: 'Sumobase PostgreSQL',
      vps: 'Sumopod',
      schema: timeRes.rows[0].schema,
      tables: tablesRes.rows.map((r: { table_name: string }) => r.table_name),
      timestamp: timeRes.rows[0].now,
      version: timeRes.rows[0].version,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      {
        status: 'error',
        message: err.message,
      },
      { status: 500 }
    );
  }
}
