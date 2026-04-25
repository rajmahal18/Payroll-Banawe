"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, RotateCcw, Trash2, X } from "lucide-react";

const OUTPUT_SIZE = 320;
const PREVIEW_SIZE = 280;
const MAX_PHOTO_LENGTH = 220_000;

function initials(name?: string) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMinScale(width: number, height: number) {
  return Math.max(PREVIEW_SIZE / width, PREVIEW_SIZE / height);
}

function clampOffset(offset: { x: number; y: number }, width: number, height: number, zoom: number) {
  const minScale = getMinScale(width, height);
  const scaledWidth = width * minScale * zoom;
  const scaledHeight = height * minScale * zoom;
  const maxX = Math.max(0, (scaledWidth - PREVIEW_SIZE) / 2);
  const maxY = Math.max(0, (scaledHeight - PREVIEW_SIZE) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY)
  };
}

export function EmployeePhotoField({
  name = "photoDataUrl",
  employeeName,
  initialValue = null
}: {
  name?: string;
  employeeName?: string;
  initialValue?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [photoValue, setPhotoValue] = useState(initialValue || "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    setPhotoValue(initialValue || "");
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  const minScale = imageSize.width && imageSize.height ? getMinScale(imageSize.width, imageSize.height) : 1;
  const displaySize = useMemo(
    () => ({
      width: imageSize.width * minScale,
      height: imageSize.height * minScale
    }),
    [imageSize.height, imageSize.width, minScale]
  );

  function openPicker() {
    inputRef.current?.click();
  }

  function closeCropper() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl("");
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > 6 * 1024 * 1024) {
      setError("Photo is too large. Use an image under 6 MB.");
      return;
    }

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setError("");
    setSourceUrl(URL.createObjectURL(file));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const target = event.currentTarget;
    setImageSize({ width: target.naturalWidth, height: target.naturalHeight });
    setOffset({ x: 0, y: 0 });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageSize.width || !imageSize.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setOffset(
      clampOffset(
        {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY
        },
        imageSize.width,
        imageSize.height,
        zoom
      )
    );
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleZoomChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextZoom = Number(event.target.value);
    setZoom(nextZoom);
    setOffset((current) => clampOffset(current, imageSize.width, imageSize.height, nextZoom));
  }

  function saveCrop() {
    const image = imageRef.current;
    if (!image || !imageSize.width || !imageSize.height) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;

    const scale = minScale * zoom;
    const sourceWidth = PREVIEW_SIZE / scale;
    const sourceHeight = PREVIEW_SIZE / scale;
    const sourceX = imageSize.width / 2 - offset.x / scale - sourceWidth / 2;
    const sourceY = imageSize.height / 2 - offset.y / scale - sourceHeight / 2;

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > MAX_PHOTO_LENGTH) {
      setError("Cropped photo is still too large. Try zooming out or choose a smaller image.");
      return;
    }

    setPhotoValue(dataUrl);
    closeCropper();
  }

  return (
    <div className="min-w-0">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input type="hidden" name={name} value={photoValue} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-[rgba(88,150,88,0.36)] bg-[linear-gradient(135deg,#e6f1ed_0%,#edf3fa_100%)] shadow-[0_14px_24px_-18px_rgba(103,140,132,0.45)]">
          {photoValue ? (
            <img src={photoValue} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-2xl font-semibold text-[#678c84]">
              {initials(employeeName) || <Camera className="h-7 w-7" />}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#2f7d5b] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25684b]"
            >
              <ImagePlus className="h-4 w-4" />
              {photoValue ? "Change Photo" : "Add Photo"}
            </button>
            {photoValue ? (
              <button
                type="button"
                onClick={() => setPhotoValue("")}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-[#7a7168]">Square crop, normalized to 320 x 320 for consistent employee photos.</p>
          {error ? <p className="mt-1 text-xs font-semibold text-rose-700">{error}</p> : null}
        </div>
      </div>

      {sourceUrl ? (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-[rgba(52,47,43,0.42)] p-3 sm:items-center sm:p-6">
          <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-[rgba(88,150,88,0.36)] bg-[rgba(250,255,247,0.98)] shadow-[0_28px_60px_-30px_rgba(22,78,43,0.24)]">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(226,219,211,0.82)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-stone-950">Crop Photo</h2>
                <p className="mt-1 text-sm text-[#7a7168]">Drag and zoom until the face sits nicely in the square.</p>
              </div>
              <button
                type="button"
                onClick={closeCropper}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white text-stone-500 transition hover:bg-[#edf8e9] hover:text-stone-900"
                aria-label="Close crop photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              <div
                className="relative mx-auto touch-none overflow-hidden rounded-[28px] border-4 border-white bg-stone-100 shadow-[0_18px_36px_-26px_rgba(22,78,43,0.32)]"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <img
                  ref={imageRef}
                  src={sourceUrl}
                  alt=""
                  draggable={false}
                  onLoad={handleImageLoad}
                  className="absolute left-1/2 top-1/2 select-none"
                  style={{
                    width: displaySize.width || PREVIEW_SIZE,
                    height: displaySize.height || PREVIEW_SIZE,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`
                  }}
                />
                <div className="pointer-events-none absolute inset-0 border border-white/80 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.10)]" />
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-slate-700">Zoom</label>
                <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={handleZoomChange} />
              </div>
              {error ? <p className="mt-2 text-sm font-semibold text-rose-700">{error}</p> : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[rgba(226,219,211,0.82)] px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(88,150,88,0.36)] bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-[#edf8e9]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
              <button
                type="button"
                onClick={saveCrop}
                className="rounded-2xl bg-[#2f7d5b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#25684b]"
              >
                Use Photo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
