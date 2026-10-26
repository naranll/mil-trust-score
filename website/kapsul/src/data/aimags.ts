// 21 аймаг + нийслэл. Төвийн координат нь аймгийн төвийн ойролцоо байршил (гэрэл энэ цэгийн орчим асна).
export type Aimag = { id: string; name: string; lat: number; lon: number };

export const AIMAGS: Aimag[] = [
  { id: "ub", name: "Улаанбаатар", lat: 47.92, lon: 106.92 },
  { id: "arkhangai", name: "Архангай", lat: 47.47, lon: 101.45 },
  { id: "bayan-olgii", name: "Баян-Өлгий", lat: 48.97, lon: 89.96 },
  { id: "bayankhongor", name: "Баянхонгор", lat: 46.19, lon: 100.72 },
  { id: "bulgan", name: "Булган", lat: 48.81, lon: 103.53 },
  { id: "govi-altai", name: "Говь-Алтай", lat: 46.37, lon: 96.26 },
  { id: "govisumber", name: "Говьсүмбэр", lat: 46.36, lon: 108.36 },
  { id: "darkhan-uul", name: "Дархан-Уул", lat: 49.47, lon: 105.97 },
  { id: "dornogovi", name: "Дорноговь", lat: 44.89, lon: 110.14 },
  { id: "dornod", name: "Дорнод", lat: 48.07, lon: 114.53 },
  { id: "dundgovi", name: "Дундговь", lat: 45.76, lon: 106.27 },
  { id: "zavkhan", name: "Завхан", lat: 47.74, lon: 96.84 },
  { id: "orkhon", name: "Орхон", lat: 49.03, lon: 104.08 },
  { id: "uvurkhangai", name: "Өвөрхангай", lat: 46.26, lon: 102.78 },
  { id: "umnugovi", name: "Өмнөговь", lat: 43.57, lon: 104.43 },
  { id: "sukhbaatar", name: "Сүхбаатар", lat: 46.68, lon: 113.28 },
  { id: "selenge", name: "Сэлэнгэ", lat: 50.23, lon: 106.21 },
  { id: "tuv", name: "Төв", lat: 47.2, lon: 106.2 },
  { id: "uvs", name: "Увс", lat: 49.98, lon: 92.07 },
  { id: "khovd", name: "Ховд", lat: 48.01, lon: 91.64 },
  { id: "khuvsgul", name: "Хөвсгөл", lat: 49.64, lon: 100.16 },
  { id: "khentii", name: "Хэнтий", lat: 47.32, lon: 110.66 },
];

export const AIMAG_BY_ID = Object.fromEntries(AIMAGS.map((a) => [a.id, a])) as Record<string, Aimag>;
