interface TagBadgeProps {
  label: string;
  color: string;
}

export const TagBadge = ({ label, color }: TagBadgeProps) => {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      {label}
    </span>
  );
};
