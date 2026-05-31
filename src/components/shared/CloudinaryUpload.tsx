"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CloudinaryUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onClear?: () => void;
  label?: string;
  folder?: string;
  /** Aspect ratio class e.g. "aspect-square" or "aspect-video" */
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
  const [error, setError] = useState<string | null>(null);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size (max 5MB)
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset ?? "inventory_uploads");
      formData.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message ?? "Upload failed");
      }

      const data = await res.json();
      onChange(data.secure_url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
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
          disabled={isUploading || !cloudName}
          className={cn(
            "relative w-full flex flex-col items-center justify-center gap-2",
            "rounded-lg border-2 border-dashed border-input bg-background",
            "text-muted-foreground hover:border-ring hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            aspectRatio,
            "min-h-[120px]"
          )}
          aria-label={label}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-6" aria-hidden="true" />
          )}
          <span className="text-xs font-medium">
            {isUploading ? "Uploading…" : label}
          </span>
          {!cloudName && (
            <span className="text-xs text-destructive">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME not set</span>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        aria-hidden="true"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
