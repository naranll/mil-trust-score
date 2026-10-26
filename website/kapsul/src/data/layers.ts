// "Cure the Core"-ийн 4 давхарга. Сайтын бүх хэсэг энэ бүтцэд тулгуурлана.
export type Layer = {
  id: "claim" | "distribution" | "production" | "cognition";
  depth: number;
  name: string;
  question: string;
  others: string; // бусад хэрэгсэл юу хийдэг вэ
  ours: string; // бид юу хийдэг вэ
  asset: string;
  href: string;
  particle: string; // 3D хэсгийн өнгө
  status: "Бэлэн" | "Гүнзгий" | "Эхлэл" | "Хэмжинэ";
};

export const LAYERS: Layer[] = [
  {
    id: "claim",
    depth: 1,
    name: "Мэдэгдэл",
    question: "Энэ пост юу гэж хэлж байна вэ?",
    others: "Нийтлэлд нэг оноо өгнө.",
    ours: "Дохиог задалж харуулна. Дүгнэлтийг та гаргана.",
    asset: "Browser extension",
    href: "/",
    particle: "#56b4e9",
    status: "Бэлэн",
  },
  {
    id: "distribution",
    depth: 2,
    name: "Тархалт",
    question: "Яагаад яг танд хүрсэн бэ?",
    others: "Энэ давхаргыг огт харуулдаггүй.",
    ours: "Feed-ийн алгоритм юуг шагнадгийг өөрийн биеэр мэдрүүлнэ.",
    asset: "Feed тоглоом",
    href: "/game",
    particle: "#0072b2",
    status: "Гүнзгий",
  },
  {
    id: "production",
    depth: 3,
    name: "Үйлдвэрлэл",
    question: "Хэн, юуны төлөө үүнийг хийсэн бэ?",
    others: "Эх сурвалжийг нэг үгээр шошголно.",
    ours: "Залилангийн эдийн засаг, хохирлын тоог ил гаргана.",
    asset: "Өгөгдөл",
    href: "/data",
    particle: "#e69f00",
    status: "Эхлэл",
  },
  {
    id: "cognition",
    depth: 4,
    name: "Танин мэдэхүй",
    question: "Би яагаад үүнд итгэх гээд байна вэ?",
    others: "Хэрэглэгчийн дадлыг үл тооно.",
    ours: "Тоглоомын өмнө ба дараа таамаглалыг тань хэмжинэ.",
    asset: "Тоглоомын төгсгөл",
    href: "/game",
    particle: "#009e73",
    status: "Хэмжинэ",
  },
];
