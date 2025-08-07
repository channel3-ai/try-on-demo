"use client";

import { useState } from "react";
import { Product } from "channel3-sdk";
import Camera from "./camera";

// Response shapes from our normalized API endpoints

type SearchResponse = {
  products: Product[];
};

type TryOnResponse = {
  eventId?: string;
  outputImage?: string; // base64 JPEG (data only)
  mediaUrls?: string[]; // absolute URLs
};

type TryOnStatusResponse = {
  status?: string;
  outputImage?: string; // base64 JPEG (data only)
  mediaUrls?: string[]; // absolute URLs
};

type ApiErrorResponse = {
  details?: unknown;
};

export default function TryOnDemo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [tryOnResult, setTryOnResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isTryingOn, setIsTryingOn] = useState(false);

  // Search for products
  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: searchQuery, limit: 6 }),
      });

      if (!response.ok) throw new Error("Search API failed");
      const data = (await response.json()) as SearchResponse;
      setSearchResults(data.products);
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please check your API key configuration.");
    }
    setIsSearching(false);
  };

  // Try on selected item
  const tryOnItem = async () => {
    if (!selectedProduct || !userPhoto) return;

    setIsTryingOn(true);
    try {
      // Convert base64 to just the data part
      const base64Data = userPhoto.split(",")[1];

      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userImage: base64Data,
          garmentImageUrl: selectedProduct.imageUrl || "",
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as TryOnResponse;

        // If we got an event ID, poll for results
        if (result.eventId) {
          const eventId = result.eventId;
          const pollInterval = setInterval(async () => {
            try {
              const statusResponse = await fetch(
                `/api/tryon-status?eventId=${eventId}`
              );
              if (!statusResponse.ok) return;

              const statusResult =
                (await statusResponse.json()) as TryOnStatusResponse;
              const mediaUrls = statusResult.mediaUrls;

              // Prefer media URLs for immediate render
              if (mediaUrls && mediaUrls.length > 0) {
                clearInterval(pollInterval);
                setTryOnResult(mediaUrls[0]);
                setIsTryingOn(false);
                return;
              }

              // Completed with base64 image
              if (
                (statusResult.status &&
                  ["ready", "completed"].includes(
                    statusResult.status.toLowerCase()
                  )) ||
                statusResult.outputImage
              ) {
                clearInterval(pollInterval);
                if (statusResult.outputImage) {
                  setTryOnResult(
                    `data:image/jpeg;base64,${statusResult.outputImage}`
                  );
                }
                setIsTryingOn(false);
              } else if (statusResult.status === "failed") {
                clearInterval(pollInterval);
                throw new Error("Try-on processing failed");
              }
            } catch (error) {
              clearInterval(pollInterval);
              console.error("Polling error:", error);
              alert("Failed to get try-on results");
              setIsTryingOn(false);
            }
          }, 2000);

          // Stop polling after 60 seconds
          setTimeout(() => {
            clearInterval(pollInterval);
            if (isTryingOn) {
              alert("Try-on timed out. Please try again.");
              setIsTryingOn(false);
            }
          }, 60000);
        } else if (result.mediaUrls && result.mediaUrls.length > 0) {
          // Direct result via media URLs
          setTryOnResult(result.mediaUrls[0]);
          setIsTryingOn(false);
        } else if (result.outputImage) {
          // Direct result (synchronous base64)
          setTryOnResult(`data:image/jpeg;base64,${result.outputImage}`);
          setIsTryingOn(false);
        }
      } else {
        const errorData = (await response.json()) as ApiErrorResponse;
        console.error("Try-on API error:", errorData);
        throw new Error(
          errorData.details
            ? JSON.stringify(errorData.details)
            : "Try-on API failed"
        );
      }
    } catch (error: any) {
      console.error("Try-on error:", error);
      alert(`Try-on failed: ${error.message || "Unknown error"}`);
      setIsTryingOn(false);
    }
  };

  // Reset all selections/results
  const reset = () => {
    setUserPhoto(null);
    setTryOnResult(null);
    setSelectedProduct(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-900">
          AI Try-On Demo
        </h1>

        {/* Step 1: Search for items */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-2xl font-semibold mb-4">
            1. Search for clothing
          </h2>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search for clothing items (e.g., 'red dress', 'blue jacket')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              aria-label="Search query"
            />
            <button
              onClick={searchProducts}
              disabled={isSearching}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {searchResults.map((product, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedProduct(product)}
                  className={`cursor-pointer border-2 rounded-lg p-2 ${
                    selectedProduct?.id === product.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <img
                    src={
                      product.imageUrl ||
                      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                    }
                    alt={product.title}
                    className="w-full h-32 object-cover rounded mb-2"
                  />
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {product.title}
                  </p>
                  <p className="text-xs text-gray-600 truncate">
                    {product.brandName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Take photo */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-2xl font-semibold mb-4">2. Take your photo</h2>

          {!userPhoto ? (
            <Camera onPhotoCapture={setUserPhoto} />
          ) : (
            <div className="text-center">
              <img
                src={userPhoto}
                alt="Your photo"
                className="w-full max-w-md mx-auto rounded-lg mb-4"
              />
              <button
                onClick={() => setUserPhoto(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Retake Photo
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Try on */}
        {selectedProduct && userPhoto && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-2xl font-semibold mb-4">3. Try it on!</h2>

            <div className="text-center mb-4">
              <p className="text-gray-700 mb-2">
                Selected:{" "}
                <span className="font-medium">{selectedProduct.title}</span> by{" "}
                {selectedProduct.brandName}
              </p>

              <button
                onClick={tryOnItem}
                disabled={isTryingOn}
                className="px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-lg font-medium inline-flex items-center justify-center"
              >
                {isTryingOn && (
                  <span
                    className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-r-transparent mr-2"
                    aria-hidden="true"
                  />
                )}
                {isTryingOn ? "Generating Try-On..." : "Try On This Item"}
              </button>
            </div>

            {/* Try-on result */}
            {tryOnResult && (
              <div className="text-center mt-6">
                <h3 className="text-xl font-semibold mb-4">
                  Your Try-On Result!
                </h3>
                <img
                  src={tryOnResult}
                  alt="Try-on result"
                  className="w-full max-w-md mx-auto rounded-lg mb-4"
                />
                <div className="flex items-center justify-center gap-3">
                  <a
                    href={selectedProduct.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Checkout
                  </a>

                  <button
                    onClick={reset}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Try Another Item
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
