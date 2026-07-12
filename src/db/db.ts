import type {
  ExerciseQuestion,
  FlashCard,
  Lesson,
  LessonCard,
  QcmQuestion,
  QuizSet,
  Subject,
} from "../types";

const DB_NAME = "revise-db";
const DB_VERSION = 1;
const STORES = ["subjects", "lessons", "quizzes", "photos"] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("subjects")) db.createObjectStore("subjects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("lessons")) db.createObjectStore("lessons", { keyPath: "id" });
      if (!db.objectStoreNames.contains("quizzes")) db.createObjectStore("quizzes", { keyPath: "lessonId" });
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

type StoreName = (typeof STORES)[number];

async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function getOne<T>(storeName: StoreName, key: string): Promise<T | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName: StoreName, value: unknown): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function remove(storeName: StoreName, key: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getSubjects(): Promise<Subject[]> {
  const subjects = await getAll<Subject>("subjects");
  return subjects.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function getSubject(id: string): Promise<Subject | undefined> {
  return getOne<Subject>("subjects", id);
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
  const subjects = await getAll<Subject>("subjects");
  const trimmed = name.trim();
  const existing = subjects.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const subject: Subject = { id: generateId(), name: trimmed, createdAt: Date.now() };
  await put("subjects", subject);
  return subject;
}

export function getLessons(): Promise<Lesson[]> {
  return getAll<Lesson>("lessons");
}

export async function getLessonsBySubject(subjectId: string): Promise<Lesson[]> {
  const lessons = await getLessons();
  return lessons
    .filter((l) => l.subjectId === subjectId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getLesson(id: string): Promise<Lesson | undefined> {
  return getOne<Lesson>("lessons", id);
}

export async function createLesson(input: {
  id: string;
  subjectId: string;
  title: string;
  photoIds: string[];
  extractedText: string;
}): Promise<Lesson> {
  const lesson: Lesson = {
    id: input.id,
    subjectId: input.subjectId,
    title: input.title,
    photoIds: input.photoIds,
    extractedText: input.extractedText,
    createdAt: Date.now(),
  };
  await put("lessons", lesson);
  return lesson;
}

export async function deleteLesson(id: string): Promise<void> {
  const lesson = await getLesson(id);
  await remove("lessons", id);
  await remove("quizzes", id);
  if (lesson) {
    await Promise.all(lesson.photoIds.map((photoId) => remove("photos", photoId)));
  }
}

export function getQuizSet(lessonId: string): Promise<QuizSet | undefined> {
  return getOne<QuizSet>("quizzes", lessonId);
}

export async function saveQuizSet(
  lessonId: string,
  qcm: QcmQuestion[],
  flashcards: FlashCard[],
  lessonCards: LessonCard[],
  exercises: ExerciseQuestion[]
): Promise<QuizSet> {
  const quizSet: QuizSet = {
    lessonId,
    qcm,
    flashcards,
    lessonCards,
    exercises,
    generatedAt: Date.now(),
  };
  await put("quizzes", quizSet);
  return quizSet;
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await put("photos", { id, blob });
}

export async function getPhotoBlob(id: string): Promise<Blob | undefined> {
  const record = await getOne<{ id: string; blob: Blob }>("photos", id);
  return record?.blob;
}
