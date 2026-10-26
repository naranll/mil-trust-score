// Хуудасны гарчиг: бүх хуудсанд ижил хэмжээ, ижил зүүн ирмэг, гарчгийн доор тайлбар.
// Хуудасны эх контейнер нь PAGE (ижил дээд зай, хажуугийн зай).
export const PAGE = "w-full px-5 pt-14 pb-10 md:px-10 md:pt-20 xl:px-16";
export const H1 = "text-[clamp(2.4rem,6vw,4.25rem)] leading-[1.04] font-bold tracking-[-0.025em] text-ink";

export function PageTitle({ title, lead, children, className = "" }: { title: string; lead?: string; children?: React.ReactNode; className?: string }) {
  return (
    <header className={className}>
      <h1 className={`max-w-[18ch] ${H1}`}>{title}</h1>
      {lead && <p className="mt-5 max-w-[56ch] text-xl leading-relaxed text-ink-2">{lead}</p>}
      {children}
    </header>
  );
}
