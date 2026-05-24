from __future__ import annotations

from pydantic import BaseModel


class AdminOverviewResponse(BaseModel):
    total_users: int
    paid_users: int
    plus_users: int
    pro_users: int
    total_documents: int
    total_sessions: int
    total_messages: int
    total_tokens: int
    total_credits_spent: int
    total_credits_granted: int


class AdminTrendCountPoint(BaseModel):
    date: str
    count: int


class AdminTrendTokensPoint(BaseModel):
    date: str
    total_tokens: int


class AdminTrendAmountPoint(BaseModel):
    date: str
    amount: int


class AdminTrendsResponse(BaseModel):
    signups: list[AdminTrendCountPoint]
    documents: list[AdminTrendCountPoint]
    tokens: list[AdminTrendTokensPoint]
    credits_spent: list[AdminTrendAmountPoint]
    active_users: list[AdminTrendCountPoint]


class AdminPlanDistributionItem(BaseModel):
    plan: str
    count: int


class AdminModelUsageItem(BaseModel):
    model: str
    calls: int
    tokens: int
    credits: int


class AdminFileTypeItem(BaseModel):
    file_type: str
    count: int


class AdminDocStatusItem(BaseModel):
    status: str
    count: int


class AdminBreakdownsResponse(BaseModel):
    plan_distribution: list[AdminPlanDistributionItem]
    model_usage: list[AdminModelUsageItem]
    file_types: list[AdminFileTypeItem]
    doc_status: list[AdminDocStatusItem]


class AdminRecentUserItem(BaseModel):
    id: str
    email: str
    name: str | None = None
    plan: str
    credits_balance: int
    created_at: str | None = None
    doc_count: int
    message_count: int


class AdminRecentUsersResponse(BaseModel):
    users: list[AdminRecentUserItem]


class AdminTopUserItem(BaseModel):
    id: str
    email: str
    name: str | None = None
    plan: str
    total_tokens: int
    total_credits: int
    doc_count: int


class AdminTopUsersResponse(BaseModel):
    users: list[AdminTopUserItem]


class AdminMetricDelta(BaseModel):
    current: int | float
    previous: int | float
    delta: int | float
    delta_percent: float | None = None


class AdminUserActivitySummary(BaseModel):
    dau: int
    wau: int
    mau: int
    signups: int
    activated_users: int
    upload_users: int
    chat_users: int
    paid_users: int
    total_users: int
    free_to_paid_rate: float
    deltas: dict[str, AdminMetricDelta]


class AdminUserActivityPoint(BaseModel):
    date: str
    signups: int = 0
    active_users: int = 0
    ai_active_users: int = 0
    uploads: int = 0
    upload_users: int = 0
    chat_users: int = 0
    messages: int = 0
    credits_spent: int = 0
    upgrade_nudge_shown: int = 0
    paywall_opened: int = 0
    limit_hit: int = 0
    billing_view: int = 0
    upgrade_click: int = 0
    checkout_created: int = 0
    checkout_completed: int = 0
    feedback_submissions: int = 0


class AdminUserActivityFunnelStage(BaseModel):
    key: str
    label: str
    users: int
    rate_from_signup: float | None = None
    rate_from_previous: float | None = None


class AdminUserRetentionRow(BaseModel):
    cohort_date: str
    cohort_size: int
    d0: int
    d1: int
    d7: int
    d30: int
    d0_rate: float
    d1_rate: float
    d7_rate: float
    d30_rate: float


class AdminUserActivitySegmentItem(BaseModel):
    key: str
    count: int
    users: int | None = None


class AdminPaidIntentReasonItem(BaseModel):
    event_name: str
    reason: str | None = None
    source: str | None = None
    plan: str | None = None
    label: str | None = None
    description: str | None = None
    events: int
    users: int


class AdminFeedbackRecentItem(BaseModel):
    id: str
    created_at: str | None = None
    type: str
    area: str
    severity: str
    status: str
    path: str | None = None
    locale: str | None = None
    plan: str | None = None
    has_message: bool
    message_preview: str | None = None


class AdminFeedbackSummary(BaseModel):
    total: int
    by_type: list[AdminUserActivitySegmentItem]
    by_area: list[AdminUserActivitySegmentItem]
    by_severity: list[AdminUserActivitySegmentItem]
    by_status: list[AdminUserActivitySegmentItem]
    recent: list[AdminFeedbackRecentItem]


class AdminUserActivitySegments(BaseModel):
    plan_distribution: list[AdminUserActivitySegmentItem]
    file_types: list[AdminUserActivitySegmentItem]
    paid_intent_reasons: list[AdminPaidIntentReasonItem]
    conversion_blockers: list[AdminPaidIntentReasonItem]


class AdminUserActivityResponse(BaseModel):
    days: int
    period: str
    since: str
    generated_at: str
    summary: AdminUserActivitySummary
    series: list[AdminUserActivityPoint]
    funnel: list[AdminUserActivityFunnelStage]
    retention: list[AdminUserRetentionRow]
    retention_explanation: str | None = None
    segments: AdminUserActivitySegments
    feedback: AdminFeedbackSummary


class AdminRetentionCell(BaseModel):
    week_offset: int
    active_users: int
    pct: float


class AdminRetentionCohort(BaseModel):
    cohort_week: str
    cohort_size: int
    retention: list[AdminRetentionCell]


class AdminRetentionCurvePoint(BaseModel):
    key: str
    label: str
    days: int
    activated_users: int
    returned_users: int
    pct: float


class AdminRetentionDauPoint(BaseModel):
    date: str
    dau: int


class AdminRetentionDauWauMau(BaseModel):
    series: list[AdminRetentionDauPoint]
    wau: int
    mau: int
    stickiness: float


class AdminRetentionSegmentItem(BaseModel):
    key: str
    label: str
    users: int
    retained_users: int
    pct: float


class AdminRetentionSegments(BaseModel):
    plan: list[AdminRetentionSegmentItem]
    doc_size: list[AdminRetentionSegmentItem]
    locale: list[AdminRetentionSegmentItem]


class AdminRetentionWeeklyFlowItem(BaseModel):
    week: str
    new: int
    retained: int
    resurrected: int
    churned: int


class AdminRetentionResponse(BaseModel):
    generated_at: str
    cohort_grid: list[AdminRetentionCohort]
    curves: list[AdminRetentionCurvePoint]
    dau_wau_mau: AdminRetentionDauWauMau
    by_segment: AdminRetentionSegments
    weekly_flow: list[AdminRetentionWeeklyFlowItem]


class AdminChurnCountPct(BaseModel):
    count: int
    pct: float


class AdminChurnOneAndDone(AdminChurnCountPct):
    activated_users: int


class AdminChurnSignalItem(AdminChurnCountPct):
    key: str
    label: str


class AdminChurnLastActionItem(AdminChurnCountPct):
    key: str
    label: str


class AdminChurnFeedbackItem(BaseModel):
    id: str
    type: str
    area: str
    severity: str
    message: str | None = None
    plan: str | None = None
    created_at: str | None = None


class AdminChurnGroupCount(BaseModel):
    key: str
    count: int


class AdminChurnFeedbackSummary(BaseModel):
    recent: list[AdminChurnFeedbackItem]
    by_area: list[AdminChurnGroupCount]
    by_severity: list[AdminChurnGroupCount]


class AdminChurnCancelReasonItem(BaseModel):
    id: str
    user_id: str
    from_plan: str
    to_plan: str
    reason: str | None = None
    feedback: str | None = None
    created_at: str | None = None


class AdminChurnResponse(BaseModel):
    generated_at: str
    inactive_days: int
    churned_users: int
    one_and_done: AdminChurnOneAndDone
    churn_signals: list[AdminChurnSignalItem]
    last_action: list[AdminChurnLastActionItem]
    feedback: AdminChurnFeedbackSummary
    cancel_reasons: list[AdminChurnCancelReasonItem]
    reason_buckets: list[AdminChurnSignalItem]
