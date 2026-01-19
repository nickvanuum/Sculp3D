export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

const UPLOADS_BUCKET = "Uploads"; // Storage bucket (case-sensitive)
const OUTPUTS_BUCKET = "Outputs"; // not used here yet, used later

export async function POST(req: NextRequest) {
  try {
    console.log("=== /api/orders HIT ===");
    console.log("Content-Type:", req.headers.get("content-type"));

    const formData = await req.formData();

    const email = String(formData.get("email") ?? "").trim();
    const bustSize = String(formData.get("bustSize") ?? "").trim();
    const style = String(formData.get("style") ?? "").trim();
    const notesRaw = formData.get("notes");
    const notes = notesRaw ? String(notesRaw) : "";

    const images = formData.getAll("images") as File[];

    if (!email || !bustSize || !style) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (images.length < 3 || images.length > 12) {
      return NextResponse.json({ error: "Upload between 3 and 12 images" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    for (const img of images) {
      if (img.size > maxSize) {
        return NextResponse.json({ error: "Each image must be less than 10MB" }, { status: 400 });
      }
    }

    // 1) Create order (status starts as "created")
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        email,
        bust_height_mm: Number(bustSize),
        bust_style: style,
        notes,
        status: "created",
      })
      .select("id")
      .single();

    if (orderError || !orderData?.id) {
      console.error("Order insert error:", orderError);
      return NextResponse.json({ error: orderError?.message ?? "Failed to create order" }, { status: 500 });
    }

    const orderId = orderData.id as string;

    // 2) Upload images to Storage bucket "Uploads"
    const uploadPromises = images.map(async (img, index) => {
      const fileName = `${orderId}/${Date.now()}-${index}-${img.name}`;
      const fileBuffer = Buffer.from(await img.arrayBuffer());

      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(UPLOADS_BUCKET)
        .upload(fileName, fileBuffer, {
          contentType: img.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error(uploadError.message);
      }

      return { storage_path: uploadData.path };
    });

    const uploaded = await Promise.all(uploadPromises);

    // 3) Insert into DB table "uploads" (your schema)
    const uploadsRows = uploaded.map((u) => ({
      order_id: orderId,
      storage_path: u.storage_path,
    }));

    const { error: uploadsError } = await supabaseAdmin.from("uploads").insert(uploadsRows);

    if (uploadsError) {
      console.error("Uploads insert error:", uploadsError);
      return NextResponse.json({ error: uploadsError.message }, { status: 500 });
    }

    // 4) Create signed URLs for up to 4 images (Meshy multi-image expects image_urls)
    const firstFour = uploaded.slice(0, 4);

    const signedUrlPromises = firstFour.map(async (u) => {
      const { data, error } = await supabaseAdmin.storage
        .from(UPLOADS_BUCKET)
        .createSignedUrl(u.storage_path, 60 * 30); // 30 minutes

      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "Failed to create signed URL");
      }
      return data.signedUrl;
    });

    const imageUrls = await Promise.all(signedUrlPromises);

    // 5) Call Meshy: Create Multi-Image to 3D task
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "MESHY_API_KEY is missing" }, { status: 500 });
    }

    const meshyRes = await fetch("https://api.meshy.ai/openapi/v1/multi-image-to-3d", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_urls: imageUrls,
         ai_model: "latest",
        should_remesh: true,
        should_texture: true,
        save_pre_remeshed_model: false,
        enable_pbr: true,
      }),
    });

    const meshyJson = await meshyRes.json().catch(() => ({}));

    if (!meshyRes.ok || !meshyJson?.result) {
      console.error("Meshy create task error:", meshyJson);
      // Mark as failed so you can see it in DB
      await supabaseAdmin.from("orders").update({ status: "failed" }).eq("id", orderId);
      return NextResponse.json({ error: "Failed to create Meshy task", details: meshyJson }, { status: 500 });
    }

    const meshyTaskId = String(meshyJson.result);

    // 6) Save task id + set status to processing
    const { error: updErr } = await supabaseAdmin
      .from("orders")
      .update({ meshy_task_id: meshyTaskId, status: "processing" })
      .eq("id", orderId);

    if (updErr) {
      console.error("Order update error:", updErr);
    }

    return NextResponse.json(
      { orderId, message: "Order created successfully", meshyTaskId },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
