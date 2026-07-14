export type Subject = {
  id: string;
  name: string;
  createdAt: number;
};

export type Lesson = {
  id: string;
  subjectId: string;
  ownerId: string;
  title: string;
  photoIds: string[];
  extractedText: string;
  simplifiedText: string | null;
  summaryText: string | null;
  createdAt: number;
};

export type QcmQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export type FlashCard = {
  question: string;
  answer: string;
};

export type LessonCard = {
  concept: string;
  explanation: string;
};

export type ExerciseQuestion = {
  question: string;
  idealAnswer: string;
};

export type QuizSet = {
  lessonId: string;
  qcm: QcmQuestion[];
  flashcards: FlashCard[];
  lessonCards: LessonCard[];
  exercises: ExerciseQuestion[];
  generatedAt: number;
};

// --- Amis et classes virtuelles ---

export type FriendRelation = "friend" | "incoming" | "outgoing";

export type FriendEntry = {
  relation: FriendRelation;
  requestId: string;
  userId: string;
  username: string;
  createdAt: number;
};

export type SchoolClass = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
};

export type ClassMember = {
  userId: string;
  username: string;
  joinedAt: number;
};

export type ClassInvitation = {
  id: string;
  classId: string;
  className: string;
  fromUsername: string;
  createdAt: number;
};

export type SharedLesson = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  subjectName: string;
  sharedByUsername: string;
  createdAt: number;
};
