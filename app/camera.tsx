"use client";

import { useState, useRef, useCallback } from "react";

interface CameraProps {
  onPhotoCapture: (photo: string) => void;
}

// Simple in-browser camera component that captures a JPEG data URL
export default function Camera({ onPhotoCapture }: CameraProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Request camera and start preview
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsStreaming(true);
      }
    } catch (error) {
      console.error("Camera error:", error);
      alert("Unable to access camera");
    }
  }, []);

  // Stop preview and release camera
  const stopCamera = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      (videoRef.current as HTMLVideoElement).srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Perform actual capture
  const performCapture = useCallback(() => {
    if (videoRef.current && isStreaming) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        onPhotoCapture(dataUrl);
        stopCamera();
      }
    }
  }, [isStreaming, onPhotoCapture, stopCamera]);

  // Start a 3-2-1 countdown, then capture
  const startCountdownAndCapture = useCallback(() => {
    if (!isStreaming || countdown !== null) return;

    let count = 3;
    setCountdown(count);

    // Clear any existing interval just in case
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    countdownIntervalRef.current = window.setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (countdownIntervalRef.current !== null) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        performCapture();
      }
    }, 1000);
  }, [isStreaming, countdown, performCapture]);

  return (
    <div className="text-center">
      <div className={`relative inline-block ${isStreaming ? "mb-4" : ""}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`mx-auto rounded-lg ${isStreaming ? "block" : "hidden"}`}
          style={{ maxWidth: "100%", width: "400px" }}
        />
        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="text-white text-8xl font-extrabold drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] select-none animate-pulse"
              aria-live="assertive"
            >
              {countdown}
            </div>
          </div>
        )}
      </div>

      {!isStreaming ? (
        <button
          onClick={startCamera}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Start Camera
        </button>
      ) : (
        <div className="flex gap-4 justify-center">
          <button
            onClick={startCountdownAndCapture}
            disabled={countdown !== null}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {countdown !== null ? "Get Ready..." : "Capture Photo"}
          </button>
          <button
            onClick={stopCamera}
            disabled={countdown !== null}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
