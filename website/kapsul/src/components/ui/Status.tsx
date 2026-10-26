// Статусын icon (Design system v3, Sheet 2): үргэлж дүүрэн, үргэлж үгтэй хамт.
// Хэлбэр бүр өөр: тойрог = үнэн, найман өнцөгт = худал, гурвалжин = төөрөгдүүлэх, элсэн цаг = шалгагдаагүй, бөмбөлөг = мэдээлэл.
export type Status = "true" | "false" | "mislead" | "unchecked" | "info";

export const STATUS_LABEL: Record<Status, string> = {
  true: "Үнэн",
  false: "Худал",
  mislead: "Төөрөгдүүлэх",
  unchecked: "Шалгагдаагүй",
  info: "Мэдээлэл",
};

const TINT: Record<Status, string> = {
  true: "bg-true-tint",
  false: "bg-false-tint",
  mislead: "bg-mislead-tint",
  unchecked: "bg-unchecked-tint",
  info: "bg-info-tint",
};

export function StatusIcon({ status, className = "size-4" }: { status: Status; className?: string }) {
  const fill = `var(--${status})`;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {status === "true" && (
        <>
          <circle cx="12" cy="12" r="10" fill={fill} />
          <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === "false" && (
        <>
          <path d="M8 2h8l6 6v8l-6 6H8l-6-6V8z" fill={fill} />
          <path d="M9 9l6 6M15 9l-6 6" stroke="#1b1d21" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {status === "mislead" && (
        <>
          <path d="M12 2.5l10.5 18.5h-21z" fill={fill} strokeLinejoin="round" />
          <path d="M12 9v5.5" stroke="#1b1d21" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="17.6" r="1.4" fill="#1b1d21" />
        </>
      )}
      {status === "unchecked" && (
        <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" />
      )}
      {status === "info" && (
        <>
          <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill={fill} />
          <path d="M12 7v5" stroke="#1b1d21" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="12" cy="14.8" r="1.3" fill="#1b1d21" />
        </>
      )}
    </svg>
  );
}

// Дүгнэлтийн chip: tint + icon + үг. Өнгө дангаараа ажиллахгүй.
export function StatusChip({ status, label }: { status: Status; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[15px] font-semibold text-ink ${TINT[status]}`}>
      <StatusIcon status={status} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
