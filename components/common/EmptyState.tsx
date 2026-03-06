import { Inbox } from "lucide-react";

export const EmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-neutral-400">
      <Inbox size={40} strokeWidth={1.5} />
      <p className="text-sm">해당 조건의 디바이스가 없습니다.</p>
    </div>
  );
};
