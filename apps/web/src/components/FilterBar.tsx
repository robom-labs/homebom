// 유형·지역·접수상태 필터 바.
import type { NoticeType } from "@zoopzoopcall/core";

export type TypeFilter = NoticeType | "전체";

type Props = {
  activeType: TypeFilter;
  onType: (t: TypeFilter) => void;
  regions: string[];
  region: string;
  onRegion: (r: string) => void;
  openOnly: boolean;
  onOpenOnly: (v: boolean) => void;
};

const TYPES: TypeFilter[] = ["전체", "무순위", "잔여세대", "취소후재공급"];

export function FilterBar({ activeType, onType, regions, region, onRegion, openOnly, onOpenOnly }: Props) {
  return (
    <div className="filters">
      <div className="filters__chips" role="tablist" aria-label="공고 유형">
        {TYPES.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeType === t}
            className={`chip${activeType === t ? " chip--active" : ""}`}
            onClick={() => onType(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="filters__row">
        <label className="filters__select">
          <span className="sr-only">지역 선택</span>
          <select value={region} onChange={(e) => onRegion(e.target.value)}>
            <option value="전체">전체 지역</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          className={`chip chip--toggle${openOnly ? " chip--active" : ""}`}
          aria-pressed={openOnly}
          onClick={() => onOpenOnly(!openOnly)}
        >
          접수중만 보기
        </button>
      </div>
    </div>
  );
}
