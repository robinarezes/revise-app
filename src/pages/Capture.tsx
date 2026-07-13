import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/Header";
import { createLesson, findOrCreateSubject, generateId, getSubjects, savePhoto } from "../db/db";
import { useProfile } from "../ProfileContext";
import { BackendError } from "../services/backendClient";
import { classifyLesson } from "../services/classifyLesson";

const XP_PER_LESSON = 10;

type StagedPhoto = { id: string; file: File; url: string; base64: string };

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function CapturePage() {
  const navigate = useNavigate();
  const { addXp, recordActivity } = useProfile();
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const staged = await Promise.all(
      files.map(async (file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        url: URL.createObjectURL(file),
        base64: await fileToBase64(file),
      }))
    );
    setPhotos((prev) => [...prev, ...staged]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleAnalyze() {
    if (photos.length === 0) return;

    setAnalyzing(true);
    try {
      const existingSubjects = (await getSubjects()).map((s) => s.name);
      const classification = await classifyLesson({
        images: photos.map((p) => ({ base64: p.base64, mediaType: p.file.type || "image/jpeg" })),
        existingSubjects,
      });

      const subject = await findOrCreateSubject(classification.subject);
      const lessonId = generateId();
      const photoIds: string[] = [];
      for (const p of photos) {
        const path = await savePhoto(lessonId, p.id, p.file);
        photoIds.push(path);
      }
      const lesson = await createLesson({
        id: lessonId,
        subjectId: subject.id,
        title: classification.title,
        photoIds,
        extractedText: classification.extractedText,
      });

      await recordActivity();
      await addXp(XP_PER_LESSON);
      navigate(`/lecon/${lesson.id}`, { replace: true, state: { xpEarned: XP_PER_LESSON } });
    } catch (e) {
      if (e instanceof BackendError && e.code === "quota_exceeded") {
        navigate("/premium?raison=quota");
        return;
      }
      const message = e instanceof Error ? e.message : "Erreur inconnue.";
      alert(`Échec de l'analyse : ${message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  if (analyzing) {
    return (
      <div className="screen">
        <Header title="Nouvelle leçon" />
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">L'IA lit ta leçon et prépare ton quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Nouvelle leçon" />
      <div className="content">
        <p className="hint">
          Prends en photo une ou plusieurs pages d'une même leçon, puis lance l'analyse.
        </p>

        <div className="actions-row">
          <button className="btn btn-primary" onClick={() => cameraInputRef.current?.click()}>
            📷 Prendre une photo
          </button>
          <button className="btn btn-secondary" onClick={() => galleryInputRef.current?.click()}>
            Depuis la galerie
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {photos.length > 0 ? (
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.id} className="thumb-wrap">
                <img src={p.url} className="thumb" alt="" />
                <button className="remove-badge" onClick={() => removePhoto(p.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <button
        className="btn btn-primary"
        style={{ margin: 20 }}
        onClick={handleAnalyze}
        disabled={photos.length === 0}
      >
        Analyser {photos.length > 0 ? `(${photos.length} photo${photos.length > 1 ? "s" : ""})` : ""}
      </button>
    </div>
  );
}
