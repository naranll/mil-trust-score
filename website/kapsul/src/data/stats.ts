// Fallback өгөгдөл: Supabase холбогдоогүй үед вэб эндээс уншина.
// Тоо бүр docs/SOURCES.md болон supabase/seed.sql-тэй ИЖИЛ байх ёстой.

export type Source = { name: string; url: string };

export type Stat = {
  key: string;
  dataset: "mn_fraud" | "mn_facebook" | "global_news" | "mn_mil" | "mn_sites" | "mn_reading";
  label: string; // монгол тайлбар
  value: number;
  unit: "%" | "count" | "mnt_bn" | "people";
  period: string;
  source: Source;
};

const CEG_GOGO: Source = { name: "ЦЕГ / gogo.mn", url: "https://gogo.mn/r/7kx0j4" };
const CEG_IKON_Y: Source = { name: "ЦЕГ / ikon.mn", url: "https://ikon.mn/n/3lqp" };
const CEG_IKON_9: Source = { name: "ЦЕГ / ikon.mn", url: "https://ikon.mn/n/3iw8" };
const CEG_IKON_ON: Source = { name: "ЦЕГ / ikon.mn", url: "https://ikon.mn/n/3ibv" };
const NAPOLEON: Source = {
  name: "NapoleonCat",
  url: "https://napoleoncat.com/stats/facebook-users-in-mongolia/",
};
const DATAREPORTAL: Source = {
  name: "DataReportal 2026",
  url: "https://datareportal.com/reports/digital-2026-mongolia",
};
const DNR: Source = {
  name: "Reuters Institute DNR 2026",
  url: "https://reutersinstitute.politics.ox.ac.uk/digital-news-report/2026/dnr-executive-summary",
};
const NUM: Source = {
  name: "МУИС, Сэтгүүл зүй",
  url: "https://journal.num.edu.mn/journalism/article/view/7029",
};
const PRESS: Source = { name: "Хэвлэлийн хүрээлэн", url: "https://pressinst.org.mn/en/?p=933" };
// Хэвлэлийн хүрээлэнгийн Мэдээлэл сургалтын албанаас авсан гарын авлага (онлайн холбоосгүй)
const PRESS_BOOK: Source = {
  name: "Хэвлэлийн хүрээлэн, «Монголын хэвлэл мэдээлэл өнөөдөр»",
  url: "",
};

export const FALLBACK_STATS: Stat[] = [
  // --- Монгол дахь залилан (ЦЕГ) ---
  { key: "fraud_2025", dataset: "mn_fraud", label: "Залилах гэмт хэрэг", value: 16906, unit: "count", period: "2025", source: CEG_GOGO },
  { key: "fraud_share_all", dataset: "mn_fraud", label: "Нийт гэмт хэрэгт эзлэх хувь", value: 35.6, unit: "%", period: "2025", source: CEG_GOGO },
  { key: "fraud_online_2025", dataset: "mn_fraud", label: "Цахим орчинд үйлдэгдсэн залилан", value: 72.3, unit: "%", period: "2025", source: CEG_IKON_Y },
  { key: "fraud_loss_2025", dataset: "mn_fraud", label: "Иргэдэд учирсан хохирол", value: 694.4, unit: "mnt_bn", period: "2025", source: CEG_IKON_Y },
  { key: "fraud_recovered_2025", dataset: "mn_fraud", label: "Нөхөн төлүүлсэн", value: 281.7, unit: "mnt_bn", period: "2025", source: CEG_IKON_Y },
  { key: "fraud_growth_9m", dataset: "mn_fraud", label: "Өмнөх оны мөн үеэс өссөн", value: 33.6, unit: "%", period: "2025 эхний 9 сар", source: CEG_IKON_9 },
  { key: "online_crime_fraud", dataset: "mn_fraud", label: "Цахим гэмт хэргийн дотор залилангийн хувь", value: 85.6, unit: "%", period: "2025 эхний 9 сар", source: CEG_IKON_ON },

  // --- Facebook Монголд ---
  { key: "fb_users_mn", dataset: "mn_facebook", label: "Facebook хэрэглэгч", value: 3042300, unit: "people", period: "2026.09", source: NAPOLEON },
  { key: "fb_pop_share", dataset: "mn_facebook", label: "Хүн амд эзлэх хувь", value: 88.5, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_18_24", dataset: "mn_facebook", label: "18–24", value: 21.0, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_25_34", dataset: "mn_facebook", label: "25–34", value: 30.4, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_35_44", dataset: "mn_facebook", label: "35–44", value: 21.2, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_45_54", dataset: "mn_facebook", label: "45–54", value: 13.1, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_55_64", dataset: "mn_facebook", label: "55–64", value: 8.7, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "fb_age_65", dataset: "mn_facebook", label: "65+", value: 5.6, unit: "%", period: "2026.09", source: NAPOLEON },
  { key: "social_ids_mn", dataset: "mn_facebook", label: "Идэвхтэй сошиал хэрэглэгч", value: 2700000, unit: "people", period: "2025.10", source: DATAREPORTAL },

  // --- Дэлхий нийт (Reuters DNR 2026) ---
  { key: "dnr_concern", dataset: "global_news", label: "Онлайн мэдээний үнэн, худлыг ялгахад санаа зовдог", value: 62, unit: "%", period: "2026", source: DNR },
  { key: "dnr_social", dataset: "global_news", label: "Мэдээг голчлон сошиал, видеогоор авдаг", value: 54, unit: "%", period: "2026", source: DNR },
  { key: "dnr_avoid", dataset: "global_news", label: "Мэдээнээс заримдаа зайлсхийдэг", value: 42, unit: "%", period: "2026", source: DNR },
  { key: "dnr_trust", dataset: "global_news", label: "Мэдээнд итгэдэг", value: 37, unit: "%", period: "2026", source: DNR },
  { key: "dnr_ai", dataset: "global_news", label: "AI чатботоор долоо хоног бүр мэдээ авдаг", value: 10, unit: "%", period: "2026", source: DNR },

  // --- Монголын MIL судалгаа ---
  { key: "num_students", dataset: "mn_mil", label: "Судалгаанд хамрагдсан оюутан (22 сургууль)", value: 560, unit: "count", period: "МУИС судалгаа", source: NUM },
  { key: "press_ethics_2015", dataset: "mn_mil", label: "Хэвлэл ёс зүйтэй гэж үзсэн иргэд", value: 57, unit: "%", period: "2015", source: PRESS },
  { key: "press_ethics_2017", dataset: "mn_mil", label: "Хэвлэл ёс зүйтэй гэж үзсэн иргэд", value: 49, unit: "%", period: "2017", source: PRESS },
  // --- Хамгийн түгээмэл зочилдог 10 мэдээллийн сайт: уншигчдын хэдэн хувь нь Улаанбаатарынх вэ (үлдсэн нь орон нутаг) ---
  { key: "site_zarig", dataset: "mn_sites", label: "Zarig.mn", value: 37, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_ikon", dataset: "mn_sites", label: "Ikon.mn", value: 59, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_gogo", dataset: "mn_sites", label: "Gogo.mn", value: 68, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_news", dataset: "mn_sites", label: "News.mn", value: 58, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_zuv", dataset: "mn_sites", label: "Zuv.mn", value: 43, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_zogii", dataset: "mn_sites", label: "Zogii.mn", value: 25, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_medee", dataset: "mn_sites", label: "Medee.mn", value: 41, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_urug", dataset: "mn_sites", label: "Urug.mn", value: 45, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_mass", dataset: "mn_sites", label: "Mass.mn", value: 44, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "site_tsahiur", dataset: "mn_sites", label: "Tsahiur.mn", value: 43, unit: "%", period: "уншигчид", source: PRESS_BOOK },

  // --- Мэдээллийн сайтаас уншдаг мэдээллийн төрөл ---
  { key: "read_current", dataset: "mn_reading", label: "Цаг үеийн мэдээ", value: 34, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_politics", dataset: "mn_reading", label: "Улс төр, эдийн засаг", value: 22, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_health", dataset: "mn_reading", label: "Эрүүл мэнд, хобби, зөвлөгөө", value: 9, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_science", dataset: "mn_reading", label: "Танин мэдэхүй, шинжлэх ухаан", value: 8, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_sport", dataset: "mn_reading", label: "Спорт", value: 8, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_entertain", dataset: "mn_reading", label: "Энтертайнмент", value: 8, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_gossip", dataset: "mn_reading", label: "Хов жив, алдартнууд, хошин шог", value: 7, unit: "%", period: "уншигчид", source: PRESS_BOOK },
  { key: "read_tech", dataset: "mn_reading", label: "Технологи, хөгжил", value: 4, unit: "%", period: "уншигчид", source: PRESS_BOOK },

  { key: "press_critical_youth", dataset: "mn_mil", label: "Мэдээнд шүүмжлэлтэй ханддаг ахлах ангийнхан", value: 40, unit: "%", period: "2019", source: PRESS },
];
