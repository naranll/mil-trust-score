// three r183+ нь THREE.Clock-ийг deprecated гэж анхааруулдаг, харин React Three Fiber 9 (хамгийн сүүлийн тогтвортой
// хувилбар) дотроо Clock ашигладаг тул Canvas бүр консолд нэг анхааруулга бичдэг. Бидний код үүнийг засах боломжгүй
// (R3F v10-д засагдана). Зөвхөн энэ нэг мэдэгдэж буй анхааруулгыг нууж, three-ийн бусад бүх лог/анхааруулгыг хэвээр нь дамжуулна.
// Canvas-тай модуль бүр үүнийг импортолно (нэг л удаа ажиллана).
import { setConsoleFunction } from "three";

const CLOCK = "THREE.Clock: This module has been deprecated";

setConsoleFunction((type: string, message: string, ...params: unknown[]) => {
  if (type === "warn" && typeof message === "string" && message.startsWith(CLOCK)) return;
  const fn = type === "error" ? console.error : type === "warn" ? console.warn : console.log;
  fn(message, ...params);
});
