// 네이티브 관심 공고와 예약 알림 ID를 웹 저장 키와 분리해 보관한다.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeNotice } from "../domain/notice";

export const NATIVE_INTERESTS_KEY = "homebom:native:interests:v1";

export type InterestRecord = {
  noticeId: string;
  notificationIds: string[];
  savedAt: string;
  /** 접수 마감 뒤 발표·계약 알림을 눌러도 원 공고 일정을 복원하기 위한 저장 당시 확인본이다. */
  notice?: NativeNotice;
};

type InterestMap = Record<string, InterestRecord>;

const EMPTY_SAVED_AT = new Date(0).toISOString();
const MILESTONE_KINDS = new Set(["announcement", "receipt", "winner", "contract"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateTime(value: unknown): value is string {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function normalizeNotice(value: unknown, expectedNoticeId: string): NativeNotice | undefined {
  if (!isRecord(value) || value.id !== expectedNoticeId) return undefined;
  if (
    !isNonEmptyString(value.manageNo)
    || !isNonEmptyString(value.pblancNo)
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.category)
    || !isNonEmptyString(value.region)
    || !isNonEmptyString(value.address)
    || !isNonEmptyString(value.sourceLabel)
    || !isNonEmptyString(value.officialUrl)
    || !Array.isArray(value.milestones)
  ) return undefined;

  const supplyCount = value.supplyCount;
  if (supplyCount !== null && (!Number.isInteger(supplyCount) || (supplyCount as number) < 0)) return undefined;

  const milestones = value.milestones.map((milestone) => {
    if (
      !isRecord(milestone)
      || !isNonEmptyString(milestone.kind)
      || !MILESTONE_KINDS.has(milestone.kind)
      || !isNonEmptyString(milestone.label)
      || !isValidDateTime(milestone.startsAt)
      || !isNonEmptyString(milestone.nextAction)
      || (milestone.endsAt !== undefined && !isValidDateTime(milestone.endsAt))
      || (milestone.notificationAt !== undefined && !isValidDateTime(milestone.notificationAt))
    ) return undefined;
    return {
      kind: milestone.kind as NativeNotice["milestones"][number]["kind"],
      label: milestone.label,
      startsAt: milestone.startsAt,
      ...(milestone.endsAt ? { endsAt: milestone.endsAt } : {}),
      nextAction: milestone.nextAction,
      ...(milestone.notificationAt ? { notificationAt: milestone.notificationAt } : {}),
    };
  });
  if (milestones.some((milestone) => milestone === undefined)) return undefined;

  return {
    id: expectedNoticeId,
    manageNo: value.manageNo,
    pblancNo: value.pblancNo,
    title: value.title,
    category: value.category,
    region: value.region,
    address: value.address,
    supplyCount: supplyCount as number | null,
    sourceLabel: value.sourceLabel,
    officialUrl: value.officialUrl,
    milestones: milestones as NativeNotice["milestones"],
  };
}

/** 구버전·부분 손상 저장값에서도 관심 상태는 보존하되 위험한 공고 스냅샷만 제외한다. */
export function normalizeInterestRecord(value: unknown, expectedNoticeId: string): InterestRecord | undefined {
  if (!isRecord(value) || value.noticeId !== expectedNoticeId) return undefined;
  const notificationIds = Array.isArray(value.notificationIds)
    ? value.notificationIds.filter(isNonEmptyString)
    : [];
  const notice = normalizeNotice(value.notice, expectedNoticeId);
  return {
    noticeId: expectedNoticeId,
    notificationIds,
    savedAt: isValidDateTime(value.savedAt) ? value.savedAt : EMPTY_SAVED_AT,
    ...(notice ? { notice } : {}),
  };
}

async function loadInterestMap(): Promise<InterestMap> {
  try {
    const raw = await AsyncStorage.getItem(NATIVE_INTERESTS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([noticeId, value]) => {
        const normalized = normalizeInterestRecord(value, noticeId);
        return normalized ? [[noticeId, normalized]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export async function loadInterest(noticeId: string): Promise<InterestRecord | undefined> {
  const interests = await loadInterestMap();
  return interests[noticeId];
}

export async function saveInterest(notice: NativeNotice, notificationIds: string[]): Promise<boolean> {
  try {
    const interests = await loadInterestMap();
    interests[notice.id] = {
      noticeId: notice.id,
      notificationIds,
      savedAt: new Date().toISOString(),
      notice,
    };
    await AsyncStorage.setItem(NATIVE_INTERESTS_KEY, JSON.stringify(interests));
    return true;
  } catch {
    return false;
  }
}

export async function removeInterest(noticeId: string): Promise<boolean> {
  try {
    const interests = await loadInterestMap();
    delete interests[noticeId];
    await AsyncStorage.setItem(NATIVE_INTERESTS_KEY, JSON.stringify(interests));
    return true;
  } catch {
    return false;
  }
}
