# zoop-holdings — 최종 파일 구조 (v1.0.0 착수용 블루프린트)

> 이 폴더(`docs/zoop-holdings/blueprint/`)의 파일들을 **새 `zoop-holdings` 저장소 루트로 복사**하면 바로 뼈대가 된다.
> 모델 A(관제 저장소): 앱 코드는 각자 저장소에 남고, holdings는 운영·자동화만 담당. 앱이 3개든 30개든 이 구조는 그대로.

```
zoop-holdings/
├─ VERSION                         # 지주회사 시스템 버전 (예: 1.0.0)
├─ CHANGELOG.md                    # 회사 운영방식 변경 이력
├─ README.md                       # 회사 소개
├─ CLAUDE.md                       # Claude에게 주는 회사 규칙(금지작업·안전선)
│
├─ .claude/
│   └─ agents/                     # AI 직원 = subagent 프롬프트
│       ├─ ceo-orchestrator.md     # 마스터: 매일 편성·검수·PR 상신
│       ├─ planner.md              # 기획 (매일)
│       ├─ builder.md              # 개발 (매일)
│       ├─ inspector.md            # 검사 (매일)
│       ├─ recorder.md             # 기록 (매일)
│       ├─ growth-marketer.md      # 홍보·성장 (매일·다채널)
│       ├─ supervisor.md           # 감독 (주간)
│       ├─ upgrader.md             # 개선연구 R&D (주간)
│       ├─ release-manager.md      # 릴리즈 (주간)
│       ├─ strategist.md           # 전략·포트폴리오 (월간)
│       └─ architect.md            # 설계 (월간)
│
├─ .github/
│   └─ workflows/
│       ├─ daily-company-run.yml   # 매일 09시: 실행 4팀 + 홍보 → PR
│       ├─ daily-marketing.yml     # 매일: 앱별 다채널 콘텐츠팩 생성 → PR
│       ├─ weekly-review.yml       # 주 1회: 감독·개선·릴리즈
│       └─ guardrails.yml          # 상시(PR마다): 안전 레일 (각 앱 저장소에도 복사)
│
└─ ops/                            # 경영기획실 / 운영 장부
    ├─ DESIGN.md                   # 이 회사 설계서 (v0.4.0 리포트)
    ├─ ROADMAP.md
    ├─ DECISIONS.md                # 확정 결정 로그 (D1~D12)
    ├─ RISK_REGISTER.md
    │
    ├─ registry/
    │   └─ apps.yml                # ★ 앱 목록 단일 소스 (앱 추가 = 여기 한 줄)
    │
    ├─ state/                      # 앱별 인수인계 문서
    │   ├─ _TEMPLATE.md
    │   ├─ holdings.md
    │   ├─ zoopzoopcall.md
    │   ├─ runningcall.md
    │   └─ pushrun.md
    │
    ├─ changelog/                  # 앱별 변경 이력
    │   └─ (앱마다 1개)
    │
    ├─ content/                    # ★ 홍보팀 산출물 (게시 대기)
    │   └─ YYYY-MM-DD/
    │       └─ <app>/
    │           ├─ youtube-shorts.md
    │           ├─ instagram.md
    │           ├─ blog-seo.md
    │           └─ community-replies.md
    │
    ├─ scorecards/
    │   ├─ app-priority.md         # 오늘 어느 앱? 점수표
    │   └─ agent-performance.md    # 직원 주간 평가
    │
    └─ playbooks/
        ├─ daily-routine.md
        ├─ marketing-channels.md   # ★ 다채널 홍보 규칙 + 스팸 금지선
        ├─ base-path-check.md
        ├─ security-boundaries.md
        ├─ release-process.md
        └─ new-app-onboarding.md
```

## 앱이 늘어날 때 (3개 → N개)
1. `ops/registry/apps.yml`에 앱 한 줄 추가
2. `ops/state/<app>.md` + `ops/changelog/<app>.md` 생성 (템플릿 복사)
3. 끝. 팀·워크플로·가드레일은 **손대지 않는다.**

## 실행 주체
- **매일 09시** `daily-company-run.yml` → 실행 4팀이 앱 1개 개선 → PR(draft)
- **매일** `daily-marketing.yml` → 홍보팀이 오늘 앱의 다채널 콘텐츠팩 생성 → PR(draft)
- **주 1회** `weekly-review.yml` → 감독·개선·릴리즈
- **상시** `guardrails.yml` → PR마다 안전검사 (사람도 AI도 못 우회)
- **사람(너)** → PR 승인·merge, 홍보 콘텐츠 실제 게시
