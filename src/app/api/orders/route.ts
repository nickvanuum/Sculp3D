import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const email = formData.get('email') as string;
    const bustSize = formData.get('bustSize') as string;
    const style = formData.get('style') as string;
    const notes = formData.get('notes') as string;

    const images = formData.getAll('images') as File[];

    // Validation
    if (!email || !bustSize || !style) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (images.length < 3 || images.length > 12) {
      return NextResponse.json({ error: 'Upload between 3 and 12 images' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    for (const img of images) {
      if (img.size > maxSize) {
        return NextResponse.json({ error: 'Each image must be less than 10MB' }, { status: 400 });
      }
    }

    // Create order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        email,
        bust_size: bustSize,
        style,
        notes,
        status: 'pending',
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('Order insert error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const orderId = orderData.id;

    // Upload images
    const uploadPromises = images.map(async (img, index) => {
      const fileName = `${orderId}/${Date.now()}-${index}-${img.name}`;
      const fileBuffer = Buffer.from(await img.arrayBuffer());

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('uploads')
        .upload(fileName, fileBuffer, {
          contentType: img.type || 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      return { filename: fileName, url: uploadData.path };
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    // Insert uploads
    const uploadsData = uploadedFiles.map(file => ({
      order_id: orderId,
      filename: file.filename,
      url: file.url,
    }));

    const { error: uploadsError } = await supabaseAdmin
      .from('uploads')
      .insert(uploadsData);

    if (uploadsError) {
      console.error('Uploads insert error:', uploadsError);
      return NextResponse.json({ error: 'Failed to save uploads' }, { status: 500 });
    }

    return NextResponse.json({ orderId, message: 'Order created successfully' }, { status: 201 });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}