interface Step {
  title: string;
  body: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface EdStepRowProps {
  steps: Step[];
}

export default function EdStepRow({ steps }: EdStepRowProps) {
  const count = steps.length;

  const colClass =
    count === 2
      ? "sm:grid-cols-2"
      : count === 4
      ? "sm:grid-cols-4"
      : "sm:grid-cols-3";

  return (
    <div
      className={`grid grid-cols-1 ${colClass}`}
      style={{ gap: "32px" }}
    >
      {steps.map((step, index) => {
        const Icon = step.icon;

        return (
          <div
            key={`step-${index}`}
            style={{
              borderTop: "1px solid var(--ed-rule)",
              paddingTop: "20px",
            }}
          >
            <div className="ed-num">{index + 1}</div>
            {Icon && (
              <div
                style={{
                  marginTop: "14px",
                  color: "var(--ed-ink-3)",
                  width: "18px",
                  height: "18px",
                }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </div>
            )}
            <h3 className="ed-h3" style={{ marginTop: "12px" }}>
              {step.title}
            </h3>
            <p className="ed-body" style={{ marginTop: "6px" }}>
              {step.body}
            </p>
          </div>
        );
      })}
    </div>
  );
}
