import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const singleFile = formData.get('file') as File | null;
    
    const allFiles = [...files, ...(singleFile ? [singleFile] : [])].filter(
      (f): f is File => f instanceof File && f.size > 0
    );

    if (allFiles.length === 0) {
      return NextResponse.json({ ok: false, error: 'No files provided' }, { status: 400 });
    }

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'grn');
    await mkdir(uploadDir, { recursive: true });

    const urls: string[] = [];

    for (const file of allFiles) {
      const mime = file.type.toLowerCase();
      if (!mime.startsWith('image/')) {
        return NextResponse.json({ ok: false, error: `Invalid file type: ${mime}. Only images are supported.` }, { status: 400 });
      }

      // Max size: 15MB
      if (file.size > 15 * 1024 * 1024) {
        return NextResponse.json({ ok: false, error: 'File size exceeds 15MB limit.' }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      let ext = 'jpg';
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('gif')) ext = 'gif';
      else if (mime.includes('heic') || mime.includes('heif')) ext = 'heic';

      const filename = `grn-${Date.now()}-${randomUUID()}.${ext}`;
      const filePath = join(uploadDir, filename);

      await writeFile(filePath, buffer);
      urls.push(`/uploads/grn/${filename}`);
    }

    return NextResponse.json({ ok: true, urls, url: urls[0] });
  } catch (error) {
    console.error('File upload failed:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'File upload failed' },
      { status: 500 }
    );
  }
}
