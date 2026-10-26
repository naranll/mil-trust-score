// Сайтын 5 хэсэг = нүүрний 5 эм. Эм бүрийн өнгө нь тухайн хэсгийн accent өнгө:
// CSS-д `--sec-<id>` (Tailwind: `bg-sec-data`, `text-sec-game` …), JS-д `SECTION_COLOR`. Okabe-Ito палитр.
export type SectionId = "extension" | "data" | "game" | "blog" | "about";

export type Section = {
  id: SectionId;
  href: string;
  label: string;
  line: string;
  color: string;
  external?: boolean;
};

// Дараалал = утсан дээрх жагсаалтын дараалал (Пост шалгагч эхэнд). Компьютер дээр Пост шалгагч голд (CSS order).
export const SECTIONS: Section[] = [
  {
    id: "extension",
    // Extension-д сайтад тусдаа хуудас байхгүй (багийн шийдвэр): суулгах заавар руу шинэ табаар.
    // Chrome Web Store-д гарвал энэ холбоосыг солино.
    href: "https://github.com/naranll/mil-trust-score/tree/main/extension#readme",
    external: true,
    label: "Пост шалгагч",
    line: "Facebook пост дээрх манипуляцын эрсдэлийг шалгана",
    color: "#D55E00",
  },
  { id: "data", href: "/data", label: "Өгөгдөл", line: "Манипуляцын хэв маягийг 3D-ээр харах", color: "#0072B2" },
  { id: "game", href: "/game", label: "Алгоритм тоглоом", line: "Нэг удаа feed-ийн алгоритм болж үзээрэй", color: "#E69F00" },
  { id: "blog", href: "/blog", label: "Блог", line: "Мэдээллийн бичиг үсгийн тухай нийтлэлүүд", color: "#009E73" },
  { id: "about", href: "/about", label: "Бидний тухай", line: "Cure the Core баг", color: "#CC79A7" },
];

export const SECTION_COLOR = Object.fromEntries(SECTIONS.map((s) => [s.id, s.color])) as Record<SectionId, string>;
