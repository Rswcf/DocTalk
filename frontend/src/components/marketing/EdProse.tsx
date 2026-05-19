interface EdProseProps {
  children: React.ReactNode;
  className?: string;
}

export default function EdProse({ children, className }: EdProseProps) {
  return (
    <div className={`ed-prose${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}
