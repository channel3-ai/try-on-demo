import { NextRequest, NextResponse } from "next/server";

// Polls Glam AI for try-on event status and normalizes the response to camelCase
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 }
      );
    }

    if (!process.env.GLAM_AI_API_KEY) {
      return NextResponse.json(
        { error: "GLAM_AI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.glam.ai/api/v1/tryon/${eventId}`,
      {
        method: "GET",
        headers: {
          accept: "application/json",
          "X-API-Key": process.env.GLAM_AI_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Glam AI status error:", response.status, errorText);
      return NextResponse.json(
        { error: "Status check failed", details: errorText },
        { status: response.status }
      );
    }

    const result: any = await response.json();

    // Normalize to camelCase
    const normalized = {
      status: result.status,
      eventId: result.eventId || result.event_id || undefined,
      mediaUrls: result.mediaUrls || result.media_urls || undefined,
      outputImage: result.outputImage || result.output_image || undefined,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Try-on status error:", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
