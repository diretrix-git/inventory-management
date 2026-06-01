"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

// Accept JPEG, PJEG (progressive JPEG), and WebP
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/webp", "image/pjpeg"];
const ACCEPT_ATTR = ".jpg,.jpeg,.webp";

// Target output constraints
const MAX_DIMENSION = 1200;   // px — longest side
const TARGET_QUALITY = 0.82;  // WebP quality (0–1)
const MAX_OUTPUT_BYTES = 300 * 1024; // 300 KB hard cap

// ─── Client-side image optimizer ─────────────────────────────────────────────

/**
 * Resizes, compresses, and converts any image to WebP using the Canvas API.
 * Iteratively reduces quality until the output is under MAX_OUTPUT_BYTES.
 * Returns a Blob ready for upload.
 */
async function optimizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Calculate new dimensions keeping aspect ratio
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Try progressively lower quality until under 300 KB
      let quality = TARGET_QUALITY;
      const tryEncode = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Failed to encode image")); return; }
            if (blob.size <= MAX_OUTPUT_BYTES || quality <= 0.3) {
              resolve(blob);
            } else {
              quality -= 0.08;
              tryEncode();
            }
          },
          "image/webp",
          quality
        );
      };
      tryEncode();
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read the image file"));
    };

    img.src = objectUrl;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CloudinaryUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onClear?: () => void;
  label?: string;
  folder?: string;
  aspectRatio?: string;
  className?: string;
}

export function CloudinaryUpload({
  value,
  onChange,
  onClear,
  label = "Upload image",
  folder = "inventory",
  aspectRatio = "aspect-square",
  className,
}: CloudinaryUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPEG or WebP image.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Validate that Cloudinary is configured
    if (!cloudName || !uploadPreset) {
      setError("Image upload is not configured. Please contact your administrator.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress("Optimizing image…");

    try {
      // Step 1: Resize, compress, convert to WebP client-side
      const optimized = await optimizeImage(file);
      const sizeKB = Math.round(optimized.size / 1024);
      setProgress(`Uploading (${sizeKB} KB)…`);

      // Step 2: Upload the optimized WebP blob to Cloudinary
      const formData = new FormData();
      formData.append("file", optimized, "image.webp");
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", folder);
      // Note: do NOT append "transformation" for unsigned uploads — Cloudinary rejects it

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        // Map Cloudinary errors to user-friendly messages
        const raw: string = json?.error?.message ?? "";
        if (raw.toLowerCase().includes("upload preset")) {
          throw new Error("Image upload is not set up correctly. Please contact your administrator.");
        }
        if (raw.toLowerCase().includes("file size")) {
          throw new Error("The image is still too large after compression. Please try a smaller image.");
        }
        throw new Error("Upload failed. Please try again.");
      }

      const data = await res.json();
      onChange(data.secure_url as string);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setProgress(null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value ? (
        <div className={cn("relative w-full overflow-hidden rounded-lg border border-border bg-muted", aspectRatio)}>
          <Image
            src={value}
            alt="Uploaded image"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center size-6 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              aria-label="Remove image"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "relative w-full flex flex-col items-center justify-center gap-2",
            "rounded-lg border-2 border-dashed border-input bg-background",
            "text-muted-foreground hover:border-ring hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            aspectRatio,
            "min-h-[120px]"
          )}
          aria-label={label}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          ) : (
            <ImageIcon className="size-6" aria-hidden="true" />
          )}
          <span className="text-xs font-medium px-2 text-center">
            {progress ?? label}
          </span>
          {!isUploading && (
            <span className="text-[10px] text-muted-foreground">
              JPEG or WebP · auto-optimized to WebP
            </span>
          )}
          {!cloudName && (
            <span className="text-xs text-destructive mt-1">Cloudinary not configured</span>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {error && (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      )}
    </div>
  );
}
