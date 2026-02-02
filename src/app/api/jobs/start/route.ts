import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, style, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'paid') {
      return NextResponse.json({ error: 'Order is not paid' }, { status: 400 });
    }

    // Fetch uploads
    const { data: uploads, error: uploadsError } = await supabaseAdmin
      .from('uploads')
      .select('filename')
      .eq('order_id', orderId);

    if (uploadsError || !uploads || uploads.length === 0) {
      return NextResponse.json({ error: 'No uploads found' }, { status: 404 });
    }

    // Generate signed URLs
    const signedUrls = await Promise.all(
      uploads.map(async (upload) => {
        const { data, error } = await supabaseAdmin.storage
          .from('uploads')
          .createSignedUrl(upload.filename, 3600); // 1 hour expiry

        if (error) throw error;
        return data.signedUrl;
      })
    );

    // Call Meshy API
    const meshyResponse = await fetch('https://api.meshy.ai/v2/image-to-3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_urls: signedUrls,
        style: order.style, // assuming style matches Meshy's expected values
      }),
    });

    if (!meshyResponse.ok) {
      const errorText = await meshyResponse.text();
      console.error('Meshy API error:', errorText);
      return NextResponse.json({ error: 'Failed to start Meshy job' }, { status: 500 });
    }

    const meshyData = await meshyResponse.json();
    const taskId = meshyData.result; // Assuming the response has result as task_id

    // Update order
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ status: 'processing', provider_task_id: taskId })
      .eq('id', orderId);

    if (updateError) {
      console.error('Update order error:', updateError);
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ taskId, message: 'Job started successfully' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
