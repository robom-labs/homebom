// 코어 Notice를 네이티브 화면용 NativeNotice로 바꾸는 순수 매핑 함수다.
import { kstDateKey, kstDateToUtcIso, normalizeYmd, type Notice } from "@zoopzoopcall/core";
import type { NativeNotice, NoticeMilestone } from "./notice";

const DAY_MS = 86_400_000;

// 화면 다음 행동 문구는 실제 데이터가 아니라 사용자 안내이므로 공고와 무관하게 일정하다.
const ANNOUNCEMENT_ACTION = "공급 대상과 신청 자격을 공고문에서 확인하세요.";
const RECEIPT_ACTION = "청약홈에서 자격을 다시 확인한 뒤 직접 접수하세요.";
const WINNER_ACTION = "청약홈에서 당첨 여부와 후속 서류를 확인하세요.";
const CONTRACT_ACTION = "필요 서류와 지정 계약 시간을 공고문에서 확인하세요.";

const SOURCE_LABEL = "한국부동산원 청약홈";

/** 접수 시작 KST 달력 하루 전 09:00을 UTC ISO로 만든다. 값이 없으면 알림 시각을 만들지 않는다. */
function notifyDayBefore(receiptStartIso: string): string | undefined {
  const ms = Date.parse(receiptStartIso);
  if (!Number.isFinite(ms)) return undefined;
  const previousYmd = kstDateKey(ms - DAY_MS);
  return kstDateToUtcIso(previousYmd, "09:00");
}

/** housingCategory → officialTypeName → 유형명 순으로 고객용 분류 문구를 고른다. */
function categoryLabel(notice: Notice): string {
  return notice.housingCategory ?? notice.officialTypeName ?? notice.type;
}

/**
 * 실제로 존재하는 필드에서만 일정을 만든다. 날짜가 없으면 해당 일정을 넣지 않으며(추측 금지),
 * 만들어진 일정은 startsAt 기준으로 오름차순 정렬한다.
 */
export function nativeNoticeFromCore(notice: Notice): NativeNotice {
  const milestones: NoticeMilestone[] = [];

  const announceYmd = normalizeYmd(notice.announceDate);
  if (announceYmd) {
    milestones.push({
      kind: "announcement",
      label: "공고",
      startsAt: kstDateToUtcIso(announceYmd, "09:00"),
      nextAction: ANNOUNCEMENT_ACTION,
    });
  }

  const receiptStartMs = Date.parse(notice.receiptStart);
  const receiptEndMs = Date.parse(notice.receiptEnd);
  if (Number.isFinite(receiptStartMs) && Number.isFinite(receiptEndMs)) {
    milestones.push({
      kind: "receipt",
      label: "접수",
      startsAt: notice.receiptStart,
      endsAt: notice.receiptEnd,
      nextAction: RECEIPT_ACTION,
      notificationAt: notifyDayBefore(notice.receiptStart),
    });
  }

  const winnerYmd = normalizeYmd(notice.winnerDate);
  if (winnerYmd) {
    milestones.push({
      kind: "winner",
      label: "발표",
      startsAt: kstDateToUtcIso(winnerYmd, "10:00"),
      nextAction: WINNER_ACTION,
      notificationAt: kstDateToUtcIso(winnerYmd, "09:00"),
    });
  }

  const contractStartYmd = normalizeYmd(notice.contractStartDate);
  if (contractStartYmd) {
    const contractEndYmd = normalizeYmd(notice.contractEndDate);
    milestones.push({
      kind: "contract",
      label: "계약",
      startsAt: kstDateToUtcIso(contractStartYmd, "09:00"),
      endsAt: contractEndYmd ? kstDateToUtcIso(contractEndYmd, "18:00") : undefined,
      nextAction: CONTRACT_ACTION,
    });
  }

  milestones.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return {
    id: notice.id,
    manageNo: notice.manageNo ?? "",
    pblancNo: notice.pblancNo ?? "",
    title: notice.houseName,
    category: categoryLabel(notice),
    region: notice.region,
    address: notice.address ?? notice.region,
    supplyCount: notice.supplyCount ?? 0,
    sourceLabel: SOURCE_LABEL,
    officialUrl: notice.applyHomeUrl,
    milestones,
  };
}
