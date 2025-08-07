import { NextRequest, NextResponse } from "next/server";
import { Channel3Client } from "channel3-sdk";

// Proxies a product search to Channel3 and returns products
export async function POST(request: NextRequest) {
  try {
    const { query, limit = 6 } = (await request.json()) as {
      query: string;
      limit?: number;
    };

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    if (!process.env.CHANNEL3_API_KEY) {
      return NextResponse.json(
        { error: "CHANNEL3_API_KEY is not set" },
        { status: 500 }
      );
    }

    const client = new Channel3Client({
      apiKey: process.env.CHANNEL3_API_KEY,
    });

    const products = await client.search({ query, limit });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
