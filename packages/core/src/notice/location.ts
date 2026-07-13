// 공고 주소를 외부 지도에서 재시도 가능한 검색 후보와 안전한 링크로 정리한다.

function compact(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*,\s*/g, " ").trim();
}

export function addressSearchCandidates(address?: string, houseName?: string, region?: string): string[] {
  const raw = compact(address ?? "");
  const withoutParentheses = compact(raw.replace(/\([^)]*\)/g, " "));
  const parenthesized = [...raw.matchAll(/\(([^)]*)\)/g)].map((match) => compact(match[1]));
  const withoutExtra = compact(
    withoutParentheses
      .replace(/\s+(일원|부근).*$/u, "")
      .replace(/\s+(공공주택지구|택지개발지구).*$/u, ""),
  );
  const nameAndRegion = compact([houseName, region].filter(Boolean).join(" "));
  return [...new Set([raw, ...parenthesized, withoutParentheses, withoutExtra, nameAndRegion].filter(Boolean))];
}

export function naverMapSearchUrl(query: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
}

export function kakaoMapSearchUrl(query: string): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;
}
