import { supabase } from "../supabaseClient";
import type {
  ExerciseQuestion,
  FlashCard,
  Lesson,
  LessonCard,
  QcmQuestion,
  QuizSet,
  Subject,
} from "../types";

export function generateId(): string {
  return crypto.randomUUID();
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Non connecté.");
  return data.user.id;
}

// --- Subjects ---

function rowToSubject(row: any): Subject {
  return { id: row.id, name: row.name, createdAt: new Date(row.created_at).getTime() };
}

export async function getSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase.from("subjects").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(rowToSubject);
}

export async function getSubject(id: string): Promise<Subject | undefined> {
  const { data } = await supabase.from("subjects").select("*").eq("id", id).maybeSingle();
  return data ? rowToSubject(data) : undefined;
}

export async function getSubjectsWithLessonCounts(): Promise<
  (Subject & { lessonCount: number })[]
> {
  const [subjects, lessons] = await Promise.all([getSubjects(), getLessons()]);
  return subjects.map((s) => ({
    ...s,
    lessonCount: lessons.filter((l) => l.subjectId === s.id).length,
  }));
}

// Case-insensitive match on name; creates a new subject if none exists.
export async function findOrCreateSubject(name: string): Promise<Subject> {
  const trimmed = name.trim();
  const subjects = await getSubjects();
  const existing = subjects.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ id: generateId(), user_id: userId, name: trimmed })
    .select()
    .single();
  if (error) throw error;
  return rowToSubject(data);
}

// --- Lessons ---

function rowToLesson(row: any): Lesson {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    photoIds: row.photo_paths ?? [],
    extractedText: row.extracted_text,
    simplifiedText: row.simplified_text ?? null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLesson);
}

export async function getLessonsBySubject(subjectId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLesson);
}

export async function getLesson(id: string): Promise<Lesson | undefined> {
  const { data } = await supabase.from("lessons").select("*").eq("id", id).maybeSingle();
  return data ? rowToLesson(data) : undefined;
}

export async function createLesson(input: {
  id: string;
  subjectId: string;
  title: string;
  photoIds: string[];
  extractedText: string;
}): Promise<Lesson> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("lessons")
    .insert({
      id: input.id,
      user_id: userId,
      subject_id: input.subjectId,
      title: input.title,
      extracted_text: input.extractedText,
      photo_paths: input.photoIds,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToLesson(data);
}

export async function saveSimplifiedText(id: string, simplifiedText: string): Promise<void> {
  const { error } = await supabase
    .from("lessons")
    .update({ simplified_text: simplifiedText })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string): Promise<void> {
  const lesson = await getLesson(id);
  if (lesson && lesson.photoIds.length > 0) {
    await supabase.storage.from("lesson-photos").remove(lesson.photoIds);
  }
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) throw error;
}

// --- Quiz sets ---

function rowToQuizSet(row: any): QuizSet {
  return {
    lessonId: row.lesson_id,
    qcm: row.qcm ?? [],
    flashcards: row.flashcards ?? [],
    lessonCards: row.lesson_cards ?? [],
    exercises: row.exercises ?? [],
    generatedAt: new Date(row.generated_at).getTime(),
  };
}

export async function getQuizSet(lessonId: string): Promise<QuizSet | undefined> {
  const { data } = await supabase
    .from("quiz_sets")
    .select("*")
    .eq("lesson_id", lessonId)
    .maybeSingle();
  return data ? rowToQuizSet(data) : undefined;
}

export async function saveQuizSet(
  lessonId: string,
  qcm: QcmQuestion[],
  flashcards: FlashCard[],
  lessonCards: LessonCard[],
  exercises: ExerciseQuestion[]
): Promise<QuizSet> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("quiz_sets")
    .upsert({
      lesson_id: lessonId,
      user_id: userId,
      qcm,
      flashcards,
      lesson_cards: lessonCards,
      exercises,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return rowToQuizSet(data);
}

// --- Photos ---

// Uploads a staged photo to Supabase Storage and returns its storage path
// (used as the lesson's photoIds entries and as the key for getPhotoBlob).
export async function savePhoto(lessonId: string, localId: string, blob: Blob): Promise<string> {
  const userId = await requireUserId();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `${userId}/${lessonId}/${localId}.${ext}`;
  const { error } = await supabase.storage.from("lesson-photos").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function getPhotoBlob(path: string): Promise<Blob | undefined> {
  const { data, error } = await supabase.storage.from("lesson-photos").download(path);
  if (error) return undefined;
  return data;
}
