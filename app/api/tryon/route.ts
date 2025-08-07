import { NextRequest, NextResponse } from "next/server";

// Handles try-on requests by:
// 1) Uploading the user image to Cloudflare Images via our upload endpoint
// 2) Calling Glam AI's try-on API with the uploaded image URL and the garment image URL
// 3) Normalizing the response to camelCase keys for the frontend

type UploadApiResponse = {
  imageUrl: string;
  imageId: string;
};

export async function POST(request: NextRequest) {
  try {
    const { userImage, garmentImageUrl } = (await request.json()) as {
      userImage: string;
      garmentImageUrl: string;
    };

    if (!userImage || !garmentImageUrl) {
      return NextResponse.json(
        {
          error: "User image and garment image URL are required",
        },
        { status: 400 }
      );
    }

    // Step 1: Upload the user image to Cloudflare Images
    const uploadResponse = await fetch(`${request.nextUrl.origin}/api/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: userImage }),
    });

    if (!uploadResponse.ok) {
      const uploadError = await uploadResponse.json();
      console.error("Upload failed:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload user image", details: uploadError },
        { status: 500 }
      );
    }

    const { imageUrl } = (await uploadResponse.json()) as UploadApiResponse;

    // Step 2: Call Glam AI with the uploaded image URL
    const response = await fetch("https://api.glam.ai/api/v1/tryon", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-API-Key": process.env.GLAM_AI_API_KEY || "",
      },
      body: JSON.stringify({
        media_url: imageUrl,
        garment_url: garmentImageUrl,
        mask_type: "overall",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Glam AI API error:", response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(
          { error: "Try-on API failed", details: errorJson },
          { status: response.status }
        );
      } catch {
        return NextResponse.json(
          { error: "Try-on API failed", details: errorText },
          { status: response.status }
        );
      }
    }

    const result: any = await response.json();

    // Step 3: Normalize response to camelCase
    const normalized = {
      eventId: result.eventId || result.event_id || undefined,
      mediaUrls: result.mediaUrls || result.media_urls || undefined,
      outputImage: result.outputImage || result.output_image || undefined,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Try-on API error:", error);
    return NextResponse.json({ error: "Try-on failed" }, { status: 500 });
  }
}
