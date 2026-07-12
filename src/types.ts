export type Subject = {
  id: string;
  name: string;
  createdAt: number;
};

export type Lesson = {
  id: string;
  subjectId: string;
  title: string;
  photoIds: string[];
  extractedText: string;
  simplifiedText: string | null;
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
