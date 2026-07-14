import { supabase } from "../supabaseClient";
import type {
  ClassInvitation,
  ClassMember,
  ExerciseQuestion,
  FlashCard,
  FriendEntry,
  Lesson,
  LessonCard,
  QcmQuestion,
  QuizSet,
  SchoolClass,
  SharedLesson,
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
    ownerId: row.user_id,
    title: row.title,
    photoIds: row.photo_paths ?? [],
    extractedText: row.extracted_text,
    simplifiedText: row.simplified_text ?? null,
    summaryText: row.summary_text ?? null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Filtre explicitement par user_id : depuis le partage de leçons dans les
// classes, la RLS autorise aussi la lecture des leçons partagées avec moi,
// donc ne plus s'appuyer sur elle seule pour "mes leçons".
export async function getLessons(): Promise<Lesson[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToLesson);
}

export async function getLessonsBySubject(subjectId: string): Promise<Lesson[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("subject_id", subjectId)
    .eq("user_id", userId)
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

export async function saveSummaryText(id: string, summaryText: string): Promise<void> {
  const { error } = await supabase.from("lessons").update({ summary_text: summaryText }).eq("id", id);
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

// --- Résultats du quiz du jour ---

export type DailyQuizResultRow = {
  subject: string;
  quizDate: string;
  score: number;
  total: number;
  xpEarned: number;
};

function rowToDailyQuizResult(row: any): DailyQuizResultRow {
  return {
    subject: row.subject,
    quizDate: row.quiz_date,
    score: row.score,
    total: row.total,
    xpEarned: row.xp_earned,
  };
}

export async function getDailyQuizResult(
  subject: string,
  quizDate: string
): Promise<DailyQuizResultRow | undefined> {
  const { data } = await supabase
    .from("daily_quiz_results")
    .select("*")
    .eq("subject", subject)
    .eq("quiz_date", quizDate)
    .maybeSingle();
  return data ? rowToDailyQuizResult(data) : undefined;
}

export async function getDailyQuizResults(quizDate: string): Promise<DailyQuizResultRow[]> {
  const { data, error } = await supabase
    .from("daily_quiz_results")
    .select("*")
    .eq("quiz_date", quizDate);
  if (error) throw error;
  return (data ?? []).map(rowToDailyQuizResult);
}

export async function saveDailyQuizResult(
  subject: string,
  quizDate: string,
  score: number,
  total: number,
  xpEarned: number
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("daily_quiz_results").insert({
    user_id: userId,
    subject,
    quiz_date: quizDate,
    score,
    total,
    xp_earned: xpEarned,
  });
  if (error) throw error;
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

// --- Amis ---

export async function searchUsersByUsername(
  query: string
): Promise<{ id: string; username: string }[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { data, error } = await supabase.rpc("search_users_by_username", { query: trimmed });
  if (error) throw error;
  return (data ?? []) as { id: string; username: string }[];
}

export async function sendFriendRequest(toUserId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("friend_requests")
    .insert({ from_user_id: userId, to_user_id: toUserId });
  if (error) throw error;
}

function rowToFriendEntry(row: any): FriendEntry {
  return {
    relation: row.relation,
    requestId: row.request_id,
    userId: row.user_id,
    username: row.username,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getFriendData(): Promise<FriendEntry[]> {
  const { data, error } = await supabase.rpc("get_my_friend_data");
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToFriendEntry);
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw error;
}

// Annule une demande envoyée, ou retire un ami déjà accepté (les deux sens
// de la relation ont le droit de supprimer la ligne).
export async function removeFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from("friend_requests").delete().eq("id", requestId);
  if (error) throw error;
}

// --- Classes virtuelles ---

function rowToSchoolClass(row: any): SchoolClass {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function createClass(name: string): Promise<SchoolClass> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("classes")
    .insert({ name: name.trim(), owner_id: userId })
    .select()
    .single();
  if (error) throw error;
  const created = rowToSchoolClass(data);
  const { error: memberError } = await supabase
    .from("class_members")
    .insert({ class_id: created.id, user_id: userId });
  if (memberError) throw memberError;
  return created;
}

export async function getMyClasses(): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSchoolClass);
}

export async function getClass(id: string): Promise<SchoolClass | undefined> {
  const { data } = await supabase.from("classes").select("*").eq("id", id).maybeSingle();
  return data ? rowToSchoolClass(data) : undefined;
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}

function rowToClassMember(row: any): ClassMember {
  return { userId: row.user_id, username: row.username, joinedAt: new Date(row.joined_at).getTime() };
}

export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  const { data, error } = await supabase.rpc("get_class_members", { p_class_id: classId });
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToClassMember);
}

export async function leaveClass(classId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function removeClassMember(classId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("class_members")
    .delete()
    .eq("class_id", classId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function inviteFriendToClass(classId: string, toUserId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("class_invitations")
    .insert({ class_id: classId, from_user_id: userId, to_user_id: toUserId });
  if (error) throw error;
}

function rowToClassInvitation(row: any): ClassInvitation {
  return {
    id: row.id,
    classId: row.class_id,
    className: row.class_name,
    fromUsername: row.from_username,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getMyClassInvitations(): Promise<ClassInvitation[]> {
  const { data, error } = await supabase.rpc("get_my_class_invitations");
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToClassInvitation);
}

// L'ordre compte : la policy d'insertion de class_members exige que
// l'invitation soit déjà passée à "accepted" avant d'accepter d'y insérer
// la ligne d'appartenance.
export async function acceptClassInvitation(invitationId: string, classId: string): Promise<void> {
  const userId = await requireUserId();
  const { error: updateError } = await supabase
    .from("class_invitations")
    .update({ status: "accepted" })
    .eq("id", invitationId);
  if (updateError) throw updateError;
  const { error: memberError } = await supabase
    .from("class_members")
    .insert({ class_id: classId, user_id: userId });
  if (memberError) throw memberError;
}

export async function declineClassInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from("class_invitations")
    .update({ status: "declined" })
    .eq("id", invitationId);
  if (error) throw error;
}

function rowToSharedLesson(row: any): SharedLesson {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    subjectName: row.subject_name,
    sharedByUsername: row.shared_by_username,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function getClassFeed(classId: string): Promise<SharedLesson[]> {
  const { data, error } = await supabase.rpc("get_class_feed", { p_class_id: classId });
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToSharedLesson);
}

export async function shareLessonToClass(classId: string, lessonId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("shared_content")
    .insert({ class_id: classId, lesson_id: lessonId, shared_by_user_id: userId });
  if (error) throw error;
}

// --- Partage direct à un ami, sans classe ---

export async function shareLessonToFriend(friendUserId: string, lessonId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("shared_content")
    .insert({ shared_with_user_id: friendUserId, lesson_id: lessonId, shared_by_user_id: userId });
  if (error) throw error;
}

export async function getDirectSharesReceived(): Promise<SharedLesson[]> {
  const { data, error } = await supabase.rpc("get_direct_shares_received");
  if (error) throw error;
  return ((data ?? []) as any[]).map(rowToSharedLesson);
}

export async function countPendingInvitations(): Promise<number> {
  const { data, error } = await supabase.rpc("count_pending_invitations");
  if (error) throw error;
  return (data as number) ?? 0;
}
