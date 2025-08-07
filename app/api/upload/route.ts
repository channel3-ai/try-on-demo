import { NextRequest, NextResponse } from "next/server";

// Creates a Cloudflare Images direct upload URL, uploads the provided base64 image, and
// returns the public image URL (or the image ID if URL construction isn't possible).

type CloudflareDirectUploadResponse = {
  result: {
    uploadURL: string;
    id: string;
  };
};

type CloudflareImageUploadResponse = {
  result: {
    id: string;
    variants?: string[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const { image } = (await request.json()) as { image: string };

    if (!image) {
      return NextResponse.json(
        { error: "Image data is required" },
        { status: 400 }
      );
    }

    // Validate credentials
    if (
      !process.env.CLOUDFLARE_ACCOUNT_ID ||
      !process.env.CLOUDFLARE_IMAGES_API_TOKEN
    ) {
      console.error("Missing Cloudflare credentials");
      return NextResponse.json(
        {
          error: "Cloudflare credentials not configured",
          details: {
            hasAccountId: !!process.env.CLOUDFLARE_ACCOUNT_ID,
            hasApiToken: !!process.env.CLOUDFLARE_IMAGES_API_TOKEN,
          },
        },
        { status: 500 }
      );
    }

    // Step 1: Get direct upload URL from Cloudflare
    const formData = new FormData();
    const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    formData.append("expiry", expiry);

    const uploadUrlResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v2/direct_upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_IMAGES_API_TOKEN}`,
        },
        body: formData,
      }
    );

    if (!uploadUrlResponse.ok) {
      const errorText = await uploadUrlResponse.text();
      console.error(
        "Cloudflare upload URL error:",
        uploadUrlResponse.status,
        errorText
      );

      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }

      return NextResponse.json(
        {
          error: "Failed to get upload URL",
          details: errorDetails,
          status: uploadUrlResponse.status,
        },
        { status: 500 }
      );
    }

    const { result } =
      (await uploadUrlResponse.json()) as CloudflareDirectUploadResponse;
    const { uploadURL } = result;

    // Step 2: Convert base64 to Blob and upload to Cloudflare
    const base64Data = image.startsWith("data:") ? image.split(",")[1] : image;
    const binaryData = Buffer.from(base64Data, "base64");
    const blob = new Blob([binaryData], { type: "image/jpeg" });

    const uploadFormData = new FormData();
    uploadFormData.append("file", blob, "photo.jpg");

    const uploadResponse = await fetch(uploadURL, {
      method: "POST",
      body: uploadFormData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error("Cloudflare upload error:", error);
      return NextResponse.json(
        { error: "Failed to upload image" },
        { status: 500 }
      );
    }

    const uploadResult =
      (await uploadResponse.json()) as CloudflareImageUploadResponse;

    // Prefer variants if available; otherwise construct using account hash
    const variants = uploadResult.result.variants || [];
    const imageId = uploadResult.result.id;

    let imageUrl: string | undefined = undefined;
    if (variants.length > 0) {
      imageUrl = variants[0];
    } else if (process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH && imageId) {
      imageUrl = `https://imagedelivery.net/${process.env.CLOUDFLARE_IMAGES_ACCOUNT_HASH}/${imageId}/public`;
    }

    if (!imageUrl) {
      return NextResponse.json(
        {
          error:
            "Could not determine public image URL. Provide CLOUDFLARE_IMAGES_ACCOUNT_HASH or enable variants in Cloudflare Images.",
          details: { imageId },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl, imageId });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
