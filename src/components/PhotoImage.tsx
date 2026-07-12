import { useEffect, useState } from "react";
import { getPhotoBlob } from "../db/db";

export function PhotoImage({
  photoId,
  className,
  onClick,
}: {
  photoId: string;
  className?: string;
  onClick?: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    getPhotoBlob(photoId).then((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);

  if (!url) return <div className={className} style={{ background: "var(--border)" }} />;
  return <img src={url} className={className} onClick={onClick} alt="" />;
}
