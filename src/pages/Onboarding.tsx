import { useState } from "react";
import { useProfile } from "../ProfileContext";
import { GradeSelection } from "./GradeSelection";
import { LanguageSelection } from "./LanguageSelection";

type Step = "grade" | "lv1" | "lv2";

export function Onboarding() {
  const { profile, updateProfile } = useProfile();
  const [step, setStep] = useState<Step | null>(null);

  const currentStep: Step = step ?? (!profile?.grade ? "grade" : !profile?.lv1 ? "lv1" : "lv2");

  if (currentStep === "grade") {
    return (
      <GradeSelection
        onChosen={(grade) => {
          updateProfile({ grade });
          setStep("lv1");
        }}
      />
    );
  }

  if (currentStep === "lv1") {
    return (
      <LanguageSelection
        emoji="🇬🇧"
        title="Ta LV1 ?"
        subtitle="Ta première langue vivante (langue A)."
        onChosen={(lv1) => {
          updateProfile({ lv1 });
          setStep("lv2");
        }}
      />
    );
  }

  return (
    <LanguageSelection
      emoji="🌍"
      title="Ta LV2 ?"
      subtitle="Ta deuxième langue vivante (langue B)."
      onChosen={(lv2) => {
        updateProfile({ lv2 });
      }}
    />
  );
}
