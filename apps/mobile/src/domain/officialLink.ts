// 검증된 청약홈 HTTPS 주소만 기기 브라우저로 여는 네이티브 링크 어댑터다.
import { Linking } from "react-native";

export const DEFAULT_APPLYHOME_URL =
  "https://www.applyhome.co.kr/";

export function resolveOfficialApplyHomeUrl(value: string | undefined): string {
  if (!value) return DEFAULT_APPLYHOME_URL;

  try {
    const url = new URL(value);
    const isApplyHome = url.hostname === "applyhome.co.kr" || url.hostname.endsWith(".applyhome.co.kr");
    return url.protocol === "https:" && isApplyHome ? url.toString() : DEFAULT_APPLYHOME_URL;
  } catch {
    return DEFAULT_APPLYHOME_URL;
  }
}

export async function openOfficialApplyHome(url: string): Promise<boolean> {
  const officialUrl = resolveOfficialApplyHomeUrl(url);

  try {
    if (!(await Linking.canOpenURL(officialUrl))) return false;
    await Linking.openURL(officialUrl);
    return true;
  } catch {
    return false;
  }
}
