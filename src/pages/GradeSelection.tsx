import { GRADES, setGrade, type Grade } from "../grade";

export function GradeSelection({ onChosen }: { onChosen: () => void }) {
  function handlePick(grade: Grade) {
    setGrade(grade);
    onChosen();
  }

  return (
    <div className="screen">
      <div className="content-center">
        <span className="celebrate-emoji">🎓</span>
        <p className="title-lg">Dans quelle classe es-tu ?</p>
        <p className="subtitle">
          Ça nous permet de te proposer le programme scolaire adapté à ton niveau.
        </p>
        <div className="grade-grid">
          {GRADES.map((g) => (
            <button key={g} className="grade-btn" onClick={() => handlePick(g)}>
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
