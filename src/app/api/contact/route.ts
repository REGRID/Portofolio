import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, project_type, estimated_date, budget_range, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: 'Nama, email, dan rincian pesan/posisi wajib diisi.' },
        { status: 400 }
      );
    }

    const res = await query(
      `
      INSERT INTO portfolio.messages (name, email, project_type, estimated_date, budget_range, message)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at;
    `,
      [
        name,
        email,
        project_type || 'Full-Time Position Inquiry',
        estimated_date || null,
        budget_range || null,
        message,
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Pesan dan penawaran kerja Anda telah berhasil dicatat. Refo akan segera merespons!',
      id: res.rows[0].id,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
