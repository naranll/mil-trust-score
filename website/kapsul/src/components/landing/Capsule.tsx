// Нүүрний гол капсул (босоо). Дээд, доод хагас нь тусдаа <g> тул GSAP тэдгээрийг салгана.
// Монохром: «цөм» саарал, жигд. Өнгө зөвхөн эмүүдэд (эмчилгээ = олон хүчин зүйл).
// Харанхуй суурь дээр хар хүрээ харагдахгүй тул хүрээ нь ink өнгөтэй.
export function Capsule({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="-8 -8 156 316" aria-hidden className={className} overflow="visible">
      <g data-cap-half="top">
        <path d="M6 150V76a64 64 0 0 1 128 0v74z" className="fill-ink stroke-ink" strokeWidth="5" strokeLinejoin="round" />
        {/* Гялбаа */}
        <path d="M30 140V82a40 40 0 0 1 22-36" fill="none" className="stroke-bg" strokeOpacity="0.18" strokeWidth="9" strokeLinecap="round" />
      </g>
      <g data-cap-half="bottom">
        <path d="M6 150v74a64 64 0 0 0 128 0v-74z" fill="#05070f" className="stroke-ink" strokeWidth="5" strokeLinejoin="round" />
        <path d="M30 162v58a40 40 0 0 0 14 30" fill="none" className="stroke-ink" strokeOpacity="0.22" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
}
