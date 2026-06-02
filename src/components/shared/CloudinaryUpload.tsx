"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ImageIcon, X, Loader2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/webp", "image/pjpeg"];
const ACCEPT_ATTR = ".jpg,.jpeg,.webp";

const MAX_DIMENSION = 1200;
const TARGET_QUALITY = 0.82;
const MAX_OUTPUT_BYTES = 300 * 1024; // 300 KB

// ─── Client-side image optimizer ─────────────────────────────────────────────

async function optimizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

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
  const [isDragOver, setIsDragOver] = useState(false);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  // ── Core upload logic ────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please use a JPEG or WebP image.");
      return;
    }

    if (!cloudName || !uploadPreset) {
      setError("Image upload is not configured. Please contact your administrator.");
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress("Optimizing…");

    try {
      const optimized = await optimizeImage(file);
      const sizeKB = Math.round(optimized.size / 1024);
      setProgress(`Uploading (${sizeKB} KB)…`);

      const formData = new FormData();
      formData.append("file", optimized, "image.webp");
      formData.append("upload_preset", uploadPreset);
      formData.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        const raw: string = json?.error?.message ?? "";
        if (raw.toLowerCase().includes("upload preset")) {
          throw new Error("Image upload is not set up correctly. Please contact your administrator.");
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
  }, [cloudName, uploadPreset, folder, onChange]);

  // ── File input change ─────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  // ── Drag and drop handlers ────────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the drop zone entirely (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((f) => ALLOWED_TYPES.includes(f.type));

    if (!imageFile) {
      setError("Please drop a JPEG or WebP image.");
      return;
    }

    processFile(imageFile);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value ? (
        /* ── Image preview ────────────────────────────────────────────────── */
        <div
          className={cn("relative w-full overflow-hidden rounded-lg border border-border bg-muted", aspectRatio)}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Image
            src={value}
            alt="Uploaded image"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
          />
          {/* Drag overlay on preview */}
          {isDragOver && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 rounded-lg z-10">
              <UploadCloud className="size-8 text-white" aria-hidden="true" />
              <span className="text-sm font-medium text-white">Drop to replace</span>
            </div>
          )}
          {/* Clear button */}
          {onClear && !isDragOver && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1.5 right-1.5 inline-flex items-center justify-center size-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
              aria-label="Remove image"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
          {/* Upload loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 rounded-lg z-10">
              <Loader2 className="size-6 animate-spin text-white" aria-hidden="true" />
              <span className="text-xs font-medium text-white">{progress}</span>
            </div>
          )}
        </div>
      ) : (
        /* ── Drop zone ────────────────────────────────────────────────────── */
        <button
          type="button"
          onClick={() => !isUploading && inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          disabled={isUploading}
          className={cn(
            "relative w-full flex flex-col items-center justify-center gap-2",
            "rounded-lg border-2 border-dashed transition-colors",
            "text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed",
            isDragOver
              ? "border-primary bg-primary/5 text-primary scale-[1.01]"
              : "border-input bg-background hover:border-ring hover:text-foreground",
            aspectRatio,
            "min-h-[140px]"
          )}
          aria-label={label}
        >
          {isUploading ? (
            <>
              <Loader2 className="size-7 animate-spin" aria-hidden="true" />
              <span className="text-xs font-medium">{progress}</span>
            </>
          ) : isDragOver ? (
            <>
              <UploadCloud className="size-8 text-primary" aria-hidden="true" />
              <span className="text-sm font-semibold text-primary">Drop to upload</span>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center size-12 rounded-full bg-muted mb-1">
                <ImageIcon className="size-6" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">
                Drag &amp; drop or <span className="text-primary underline underline-offset-2">click to browse</span>
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">
                JPEG or WebP · auto-compressed to WebP
              </span>
              {!cloudName && (
                <span className="text-xs text-destructive mt-1">Cloudinary not configured</span>
              )}
            </>
          )}
        </button>
      )}

      {/* Hidden file input */}
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
