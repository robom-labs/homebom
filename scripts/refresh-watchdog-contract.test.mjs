// 청약봄의 누락 스케줄 자동 복구 작업이 인증·최신성 조건·재시도 간격을 유지하는지 검증한다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260808112000_homebom_refresh_watchdog.sql",
  import.meta.url,
);

test("수집 감시 작업은 오래된 active 스냅샷만 Vault 인증으로 재시도한다", async () => {
  const source = await readFile(migrationUrl, "utf8");
  assert.match(source, /homebom-notices-refresh-watchdog/);
  assert.match(source, /'35,50 \* \* \* \*'/);
  assert.match(source, /feed_key = 'active'/);
  assert.match(source, /interval '75 minutes'/);
  assert.match(source, /homebom_notice_sync_token/);
  assert.match(source, /not exists/);
  assert.doesNotMatch(source, /service_role|anon_key|eyJ/u);
});
