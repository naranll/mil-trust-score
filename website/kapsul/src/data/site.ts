// Сайтын тохиргоо. Extension-ий татах линк бэлэн болмогц энд оруулна.
export const SITE = {
  extensionUrl: "", // жишээ нь: "https://github.com/<team>/<repo>/releases/latest"
  hackathon: "HACKMIL 2026",
};

// Багийн гишүүд. [ ] доторх нэрийг жинхэнэ нэрээр солино.
export const TEAM = [
  { name: "М.Мөнх-Оргил", role: "Өгөгдөл ба загвар", note: "Монгол текстийн өгөгдөл цуглуулж, манипуляцийн дохиог таних загвар сургасан.", placeholder: false },
  { name: "[Гишүүн 2]", role: "Backend", note: "Extension-ий текстийг шинжлэх API.", placeholder: true },
  { name: "[Гишүүн 3]", role: "Extension ба UI", note: "Facebook дээр ажилладаг Chrome extension.", placeholder: true },
  { name: "[Гишүүн 4]", role: "MIL контент ба танилцуулга", note: "Блог, видео, демо.", placeholder: true },
];
