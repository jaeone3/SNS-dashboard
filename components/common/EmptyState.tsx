import { Inbox } from "lucide-react";

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-400">
      <Inbox size={40} strokeWidth={1.5} />
      <p className="text-sm">No accounts found. Add one from Manage.</p>
    </div>
  );
};
