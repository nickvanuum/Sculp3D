import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Fetch order
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, provider_task_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'processing') {
      return NextResponse.json({ error: 'Order is not in processing status' }, { status: 400 });
    }

    const taskId = order.provider_task_id;
    if (!taskId) {
      return NextResponse.json({ error: 'No task ID found' }, { status: 400 });
    }

    // Poll Meshy API
    const meshyResponse = await fetch(`https://api.meshy.ai/v2/image-to-3d/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
      },
    });

    if (!meshyResponse.ok) {
      const errorText = await meshyResponse.text();
      console.error('Meshy API error:', errorText);
      return NextResponse.json({ error: 'Failed to poll Meshy task' }, { status: 500 });
    }

    const meshyData = await meshyResponse.json();
    const status = meshyData.status;

    if (status === 'SUCCEEDED') {
      // Download and upload model
      const modelUrl = meshyData.model_urls[0]; // Assuming first is GLB
      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) {
        console.error('Failed to download model');
        return NextResponse.json({ error: 'Failed to download model' }, { status: 500 });
      }
      const modelBuffer = await modelResponse.arrayBuffer();
      const modelFilename = `${orderId}.glb`;

      const { error: modelUploadError } = await supabaseAdmin.storage
        .from('models')
        .upload(modelFilename, modelBuffer, {
          contentType: 'model/gltf-binary',
        });

      if (modelUploadError) {
        console.error('Model upload error:', modelUploadError);
        return NextResponse.json({ error: 'Failed to upload model' }, { status: 500 });
      }

      const { data: modelPublicUrl } = supabaseAdmin.storage
        .from('models')
        .getPublicUrl(modelFilename);

      // Download and upload preview
      const previewUrl = meshyData.thumbnail_url;
      const previewResponse = await fetch(previewUrl);
      if (!previewResponse.ok) {
        console.error('Failed to download preview');
        return NextResponse.json({ error: 'Failed to download preview' }, { status: 500 });
      }
      const previewBuffer = await previewResponse.arrayBuffer();
      const previewFilename = `${orderId}.png`;

      const { error: previewUploadError } = await supabaseAdmin.storage
        .from('models')
        .upload(previewFilename, previewBuffer, {
          contentType: 'image/png',
        });

      if (previewUploadError) {
        console.error('Preview upload error:', previewUploadError);
        return NextResponse.json({ error: 'Failed to upload preview' }, { status: 500 });
      }

      const { data: previewPublicUrl } = supabaseAdmin.storage
        .from('models')
        .getPublicUrl(previewFilename);

      // Update order
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'completed',
          model_url: modelPublicUrl.publicUrl,
          preview_url: previewPublicUrl.publicUrl,
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('Update order error:', updateError);
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
      }

      return NextResponse.json({ status: 'completed', modelUrl: modelPublicUrl.publicUrl, previewUrl: previewPublicUrl.publicUrl });
    } else if (status === 'FAILED') {
      // Update order to failed
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'failed' })
        .eq('id', orderId);

      if (updateError) {
        console.error('Update order error:', updateError);
      }

      return NextResponse.json({ status: 'failed' });
    } else {
      // PENDING or other
      return NextResponse.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
