"""
Generate a comprehensive high-resolution metrics reference table image.
Covers ALL metrics across People, Health, Services, Sessions, and Cohort sections.
Output: metrics_reference_table.png
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch

# ─── COLOUR PALETTE ──────────────────────────────────────────────────────────
BG          = '#0D1117'
HEADER_BG   = '#161B22'
SECTION_BG  = '#1C2333'
ROW_EVEN    = '#0D1117'
ROW_ODD     = '#111827'
BORDER      = '#30363D'
WHITE       = '#E6EDF3'
MUTED       = '#8B949E'
BLUE        = '#58A6FF'
GREEN       = '#3FB950'
AMBER       = '#D29922'
RED         = '#F85149'
PURPLE      = '#BC8CFF'
CYAN        = '#39D0D8'
ORANGE      = '#FFA657'

# ─── SECTIONS AND METRICS ────────────────────────────────────────────────────
# Each metric: (Name, Threshold/Target, Formula, Description, Source Table(s), Key Columns)

SECTIONS = [
    {
        'title': 'PEOPLE  /  USER HEALTH',
        'color': BLUE,
        'rows': [
            ('Health Score',
             '≥60 Active\n40–59 At-Risk\n<40 Alert',
             '(login_norm + action_norm\n+ module_norm + report_norm)\n÷ 4 × 100  [min-max]',
             'Composite 0–100 score per user\nacross login frequency, action\nvolume, module breadth, reports',
             'raw_iam_activities\nraw_audit_logs',
             'user_id, type(LOGIN)\nservice_id, type(REPORT)'),

            ('Login Success Rate',
             '≥90% target\n<70% alert',
             'LOGIN_count /\n(LOGIN + INVALID_LOGIN)\n× 100',
             '% of login attempts that\nsucceeded in rolling 30-day\nwindow per user',
             'raw_iam_activities',
             'user_id, type\n(LOGIN / INVALID LOGIN)'),

            ('Active Users — Today',
             'Trend ↑ healthy\nDrop >20% alert',
             'COUNT DISTINCT user_id\nwhere type=LOGIN\nAND date = today',
             'Unique users who logged in\non the current calendar day\n(platform_id=6 filtered)',
             'raw_iam_activities',
             'user_id, type, created_on\nplatform_id'),

            ('Active Users — 7 d',
             'vs prev-7d ±15%\nnormal band',
             'COUNT DISTINCT user_id\nwhere type=LOGIN\nAND ts ≥ today−7d',
             'Unique users active in the\nlast 7 days; compared to\nprevious 7-day period for trend',
             'raw_iam_activities',
             'user_id, type, created_on'),

            ('Active Users — 30 d',
             'vs prev-30d ±20%\nnormal band',
             'COUNT DISTINCT user_id\nwhere type=LOGIN\nAND ts ≥ today−30d',
             'Unique users active in the\nlast 30 days; primary KPI\nfor monthly engagement',
             'raw_iam_activities',
             'user_id, type, created_on'),

            ('Dormant Users',
             '<10% target\n>25% alert',
             'total_users −\nactive_users_30d',
             'Accounts with zero recorded\nLOGIN activity in the rolling\n30-day window',
             'raw_iam_activities\nraw_iam_users',
             'user_id, type, created_on\nplatform_id'),

            ('New Activations — 30 d',
             'Growth ↑ positive\ndrop flags churn',
             'COUNT users whose first\nLOGIN ts ≥ today−30d',
             'Users logging in for the\nfirst time within the last\n30 days (first_seen date)',
             'raw_iam_activities',
             'user_id, type\ncreated_on (MIN per user)'),

            ('User Status',
             'Active / At-Risk\n/ Inactive tiers',
             'health ≥60 → Active\n40≤h<60 → At-Risk\nh<40 → Inactive',
             'Categorical tier derived\ndirectly from Health Score;\nused for colour-coding in UI',
             'derived from\nHealth Score',
             'health_score threshold\nfrom config.ts'),
        ],
    },
    {
        'title': 'PLATFORM HEALTH  /  SUCCESS & FAILURES',
        'color': RED,
        'rows': [
            ('Overall Success Rate',
             '≥95% target\n<90% alert',
             'SUCCESS_events /\ntotal_audit_events\n× 100  (30d)',
             '% of all audit-log events\nthat carried status=SUCCESS\nin the last 30 days',
             'raw_audit_logs',
             'status(SUCCESS/FAIL)\ncreated_on, platform_id'),

            ('Login Success Rate\n(Platform)',
             '≥95% target\n<90% alert',
             'LOGIN / (LOGIN +\nINVALID_LOGIN) × 100\nacross all users',
             'Platform-wide login success\nrate (aggregate of all users)\nover rolling 30 days',
             'raw_iam_activities',
             'type, created_on\nplatform_id'),

            ('Failed Events — 30 d',
             '0 ideal\n>50 alert',
             'COUNT audit_logs\nwhere status IN\n(FAILED, FAILURE)',
             'Total number of non-SUCCESS\naudit events in last 30 days;\nbreakdown by service available',
             'raw_audit_logs',
             'status, service_id\ncreated_on'),

            ('Unique Error Types',
             '<5 healthy\n>15 investigate',
             'COUNT DISTINCT\nevent_id where\nstatus ≠ SUCCESS',
             'How many distinct failure\npatterns (event types) produced\nerrors in the last 30 days',
             'raw_audit_logs\nraw_iam_events',
             'event_id, status\nlabel'),

            ('Failure Concentration',
             'Distributed OK\nSingle svc → risk',
             'IF top_svc_failures /\ntotal_failures > 0.6\n→ "Concentrated"',
             'Whether failures cluster in\none service or spread across\nmany; surfaces single-point risk',
             'raw_audit_logs',
             'service_id, status\ncreated_on'),

            ('Consecutive Fail\nStreaks',
             '0 target\n>3 in a row alert',
             'MAX consecutive\nfailed events per\nservice (ordered by ts)',
             'Longest run of back-to-back\nfailures for any service;\nindicates sustained outage',
             'raw_audit_logs',
             'service_id, status\ncreated_on (ordered)'),

            ('Success Rate Trend\n(vs prev 30 d)',
             'Δ ≥ 0 healthy\nΔ < −2% alert',
             '(sr_current_30d −\nsr_prev_30d)',
             'Point-difference in success\nrate compared to the prior\n30-day period',
             'raw_audit_logs',
             'status, created_on\n(two 30d windows)'),
        ],
    },
    {
        'title': 'SERVICES  /  MODULE USAGE & RELIABILITY',
        'color': GREEN,
        'rows': [
            ('Service Success Rate',
             '≥95% per service\n<90% alert banner',
             'SUCCESS / total_events\n× 100 per service_id\n(30d window)',
             '% of audit events that\nsucceeded for each IAM\nmodule/service individually',
             'raw_audit_logs\nraw_iam_services',
             'service_id, status\ncreated_on'),

            ('Service Events — 30 d',
             'Baseline ±30%\nnormal variation',
             'COUNT audit_logs\nwhere service_id=X\nAND ts ≥ today−30d',
             'Total event volume for each\nservice in last 30 days;\nused to rank service activity',
             'raw_audit_logs',
             'service_id\ncreated_on'),

            ('Active Users\nper Service',
             'Display metric\nno hard threshold',
             'COUNT DISTINCT user_id\nper service_id\n(30d window)',
             'How many unique users\ninteracted with each service\nin the last 30 days',
             'raw_audit_logs',
             'service_id, user_id\ncreated_on'),

            ('Service Trend\n(events vs prev)',
             'Δ ≥ 0 growing\nΔ < −20% alert',
             '(events_30d −\nevents_prev_30d) /\nevents_prev_30d × 100',
             '% change in event volume\nfor each service compared\nto the previous 30-day period',
             'raw_audit_logs',
             'service_id, created_on\n(two 30d windows)'),

            ('Report Count — 30 d',
             'Trend tracked\nno fixed threshold',
             'COUNT events where\ntype IN (REPORT,\nREPORT-ALL-GILE)',
             'Total report-generation\nevents per service; indicates\ndata-export activity',
             'raw_audit_logs',
             'service_id, type\ncreated_on'),

            ('Peak Hour\nper Service',
             'Display / planning\nno threshold',
             'MODE(HOUR(created_on))\nper service_id\nacross 30d events',
             'Hour of day (0–23) with\nthe most activity for each\nservice; used for heatmap',
             'raw_audit_logs',
             'service_id\ncreated_on (HOUR extract)'),

            ('Event Heatmap\nDensity',
             'Spike >3σ flags\nabnormal activity',
             'COUNT per\n(service, hour) bucket\nacross 30d window',
             'Cross-matrix of service × hour\nshowing when each module\nis most heavily used',
             'raw_audit_logs',
             'service_id, created_on\n(hour bucketed)'),

            ('Active Services\nCount',
             'Stable count OK\ndrop >2 alert',
             'COUNT DISTINCT\nservice_id with ≥1\nevent in last 30d',
             'Number of distinct IAM\nservices that recorded at\nleast one event in 30 days',
             'raw_audit_logs',
             'service_id\ncreated_on'),
        ],
    },
    {
        'title': 'SESSIONS  /  ENGAGEMENT & BEHAVIOUR',
        'color': PURPLE,
        'rows': [
            ('Total Sessions — 30 d',
             'Trend ↑ healthy\nDrop >15% alert',
             'COUNT sessions where\ngap >3600s between\nevents = new session',
             'Total user sessions detected\nusing 1-hour inactivity gap\nalgorithm on iam_activities',
             'raw_iam_activities',
             'user_id, created_on\n(3600s gap algorithm)'),

            ('Avg Session Duration',
             '>5 min healthy\n<1 min suspicious',
             'SUM(session_end −\nsession_start) /\nCOUNT(sessions)  ÷ 60',
             'Mean time in minutes a user\nspends in a single session;\nvery short = bounce',
             'raw_iam_activities',
             'user_id, created_on\n(session boundaries)'),

            ('Median Session\nDuration',
             '>3 min healthy\ncompare to mean',
             'PERCENTILE_50 of\n(session_end − start)\nacross all sessions ÷ 60',
             'Median session length; less\nsensitive to outliers than mean;\nuse alongside avg for skew',
             'raw_iam_activities',
             'user_id, created_on\nsession duration array'),

            ('Avg Events\nper Session',
             '>3 healthy\n1 = bounce/login-only',
             'COUNT audit_events\nlinked to session /\nCOUNT(sessions)',
             'Mean number of audit-log\nactions within a single session;\nlow = shallow engagement',
             'raw_audit_logs\nraw_iam_activities',
             'session_id (synthetic)\nuser_id, created_on'),

            ('Bounce Rate',
             '<20% target\n>40% alert',
             'sessions with 0\naudit actions /\ntotal_sessions × 100',
             '% of sessions where user\nlogged in but performed no\naudit-tracked action',
             'raw_iam_activities\nraw_audit_logs',
             'session_id, user_id\naudit event linkage'),

            ('Session Completion\nRate',
             '>80% target\n<60% alert',
             'sessions WITH ≥1\nlinked audit event /\ntotal_sessions × 100',
             'Inverse of bounce rate;\n% of sessions where at least\none substantive action occurred',
             'raw_iam_activities\nraw_audit_logs',
             'session_id (±30-min\nlinkage window)'),

            ('Cross-Module Rate',
             '>30% healthy\n<15% alert',
             'sessions using ≥3\ndistinct services /\ntotal_sessions × 100',
             '% of sessions where user\ntouched 3+ different IAM\nmodules (breadth of use)',
             'raw_audit_logs',
             'session_id, service_id\n(≥3 distinct per session)'),

            ('Sessions per User\n(Avg)',
             '>2/month healthy\n1 = minimal use',
             'total_sessions_30d /\nactive_users_30d',
             'Average number of sessions\neach active user initiates\nper 30-day period',
             'raw_iam_activities',
             'user_id, session_id\n(30d window)'),

            ('Peak Hour\n(Platform-wide)',
             'Display / planning\nno fixed threshold',
             'MODE(session.hour)\nacross all sessions\nin last 30d',
             'Hour of day (0–23) when\nmost sessions are started;\nused for capacity planning',
             'raw_iam_activities',
             'created_on\n(HOUR extract)'),
        ],
    },
    {
        'title': 'COHORTS  /  RETENTION & LIFECYCLE',
        'color': AMBER,
        'rows': [
            ('Cohort Retention\n— Week 1',
             '>60% healthy\n<40% alert',
             'users active in\nweek1 / cohort_size\n× 100',
             '% of users in a monthly\ncohort who returned and\nwere active in week 1',
             'raw_iam_activities',
             'user_id, created_on\n(cohort = first-login month)'),

            ('Cohort Retention\n— Week 2',
             '>50% healthy\n<30% alert',
             'users active in\nweek2 / cohort_size\n× 100',
             '% of cohort still active\nin week 2; measures early\nretention curve shape',
             'raw_iam_activities',
             'user_id, created_on\ncohort month grouping'),

            ('Cohort Retention\n— Week 4',
             '>40% healthy\n<20% alert',
             'users active in\nweek4 / cohort_size\n× 100',
             '% of cohort active at\nfour weeks; end-of-month\nretention benchmark',
             'raw_iam_activities',
             'user_id, created_on\ncohort month grouping'),

            ('Cohort Retention\n— Month 2',
             '>30% healthy\n<15% alert',
             'users active in\nmonth2 / cohort_size\n× 100',
             '% of cohort returning\nin the second calendar\nmonth after first login',
             'raw_iam_activities',
             'user_id, created_on\ncohort month grouping'),

            ('Cohort Retention\n— Month 3',
             '>25% healthy\n<10% alert',
             'users active in\nmonth3 / cohort_size\n× 100',
             '% of cohort still active\nthree months in; long-term\nstickiness indicator',
             'raw_iam_activities',
             'user_id, created_on\ncohort month grouping'),

            ('Cohort Size',
             'Display only\n(volume metric)',
             'COUNT users whose\nfirst_seen month\n= cohort_month',
             'Number of users who had\ntheir first login in a given\ncalendar month',
             'raw_iam_activities',
             'user_id, created_on\n(MIN per user = first_seen)'),
        ],
    },
    {
        'title': 'CUSTOM METRICS  /  BUILDER & ALERTS',
        'color': CYAN,
        'rows': [
            ('Alert Severity Score',
             '0–3 Low\n4–6 Medium\n7–10 High',
             'weighted_sum(\n  breach_flags ×\n  severity_weight\n) / max_possible × 10',
             '0–10 composite score\ndriven by how many platform\nthresholds are breached',
             'derived (all\nmetrics above)',
             'threshold breach flags\nseverity_weight in config.ts'),

            ('Top-N User\nActivity Rank',
             'Display only\n(no threshold)',
             'RANK() OVER\n(ORDER BY sessions_30d\n+ events_30d DESC)',
             'Ordinal rank of users\nby combined session count\nand total audit action count',
             'raw_iam_activities\nraw_audit_logs',
             'user_id, sessions_30d\nevents_30d'),

            ('Platform Activity\nIndex',
             'Baseline ±15%\nspike → alert',
             'total_events_today /\n30d_daily_avg',
             'Ratio of today\'s event\nvolume vs trailing 30-day\ndaily average (1.0 = normal)',
             'raw_iam_activities\nraw_audit_logs',
             'created_on, platform_id\nDATE(created_on) grouping'),

            ('Group Membership\nCoverage',
             '100% target\n<90% alert',
             'users_in_≥1_group /\ntotal_users × 100',
             '% of users assigned to at\nleast one IAM access-control\ngroup (not orphaned)',
             'raw_iam_user_groups\nraw_iam_users',
             'user_id, group_id\ndeleted_on IS NULL'),

            ('MFA Adoption Rate',
             '≥80% target\n<50% alert',
             'COUNT(mfa_enabled=1)\n/ total_users × 100',
             '% of users with multi-factor\nauthentication enabled;\nderived from user profile flag',
             'raw_iam_users',
             'user_id, mfa_enabled\nplatform_id'),

            ('Custom Metric\n(Formula Builder)',
             'User-defined\nthreshold',
             'User-supplied formula\nevaluated server-side\nvia /api/metrics/compute',
             'Any metric the analyst\ndefines via the Metrics Builder\nUI; stored in Zustand + localStorage',
             'any dx_* dataset\nor raw table',
             'formula string\npinnedTo sections[]'),
        ],
    },
]

# ─── LAYOUT CONSTANTS ────────────────────────────────────────────────────────
COL_W    = [0.130, 0.110, 0.175, 0.180, 0.150, 0.175]   # fractions of usable width
COLS     = ['Metric', 'Threshold / Target', 'Formula', 'Description', 'Source Tables', 'Key Columns']
LEFT     = 0.018
RIGHT    = 0.982
USABLE_W = RIGHT - LEFT

ROW_H    = 0.0195
HDR_H    = 0.013
SEC_H    = 0.012
TOP_TITLE= 0.978

total_rows = sum(len(s['rows']) for s in SECTIONS)
total_h_needed = (
    0.04                          # title block
    + len(SECTIONS) * (SEC_H + HDR_H)   # section banners + col headers
    + total_rows * ROW_H          # data rows
    + 0.025                       # legend + footer
)

FIG_W  = 32
FIG_H  = max(22, total_h_needed * 32 / 0.96)   # scale so content fills ~96% height

fig = plt.figure(figsize=(FIG_W, FIG_H))
fig.patch.set_facecolor(BG)
ax = fig.add_axes([0, 0, 1, 1])
ax.set_axis_off()
ax.set_xlim(0, 1); ax.set_ylim(0, 1)

# ─── TITLE ───────────────────────────────────────────────────────────────────
fig.text(0.5, TOP_TITLE,
         'GrayQuest IAM Analytics Dashboard — Complete Metrics Reference',
         ha='center', va='top', fontsize=19, fontweight='bold',
         color=WHITE, fontfamily='monospace')
fig.text(0.5, TOP_TITLE - 0.018,
         f'All {total_rows} Metrics  ·  Thresholds · Formulas · Source Tables · Key Columns  ·  platform_id=6  ·  Rolling 30-day window',
         ha='center', va='top', fontsize=10.5, color=MUTED, fontfamily='monospace')
fig.add_artist(plt.Line2D(
    [LEFT, RIGHT], [TOP_TITLE - 0.03, TOP_TITLE - 0.03],
    transform=fig.transFigure, color=BLUE, linewidth=1.2, alpha=0.6))

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def draw_rect(x, y, w, h, bg, border=BORDER, lw=0.4, zorder=2):
    rect = FancyBboxPatch((x, y), w, h,
        boxstyle='square,pad=0', linewidth=lw,
        edgecolor=border, facecolor=bg,
        transform=fig.transFigure, zorder=zorder)
    fig.add_artist(rect)

def draw_text(x, y, text, color, fs, bold=False, mono=False, ha='left', va='center', zorder=3):
    fw = 'bold' if bold else 'normal'
    ff = 'monospace' if mono else 'DejaVu Sans'
    fig.text(x, y, text, ha=ha, va=va, fontsize=fs, color=color,
             fontweight=fw, fontfamily=ff, multialignment='left',
             transform=fig.transFigure, zorder=zorder)

def col_xs():
    xs, x = [], LEFT
    for frac in COL_W:
        xs.append(x)
        x += frac * USABLE_W
    return xs

# ─── DRAW SECTIONS ───────────────────────────────────────────────────────────
cursor_y = TOP_TITLE - 0.038   # start just below title

for sec in SECTIONS:
    sc = sec['color']

    # ── Section banner ──
    draw_rect(LEFT, cursor_y - SEC_H, USABLE_W, SEC_H, SECTION_BG, border=sc, lw=1.2, zorder=2)
    # left accent bar
    draw_rect(LEFT, cursor_y - SEC_H, 0.0045, SEC_H, sc, border=sc, lw=0, zorder=3)
    draw_text(LEFT + 0.007, cursor_y - SEC_H * 0.5,
              sec['title'], sc, fs=8.5, bold=True, mono=True, va='center')
    cursor_y -= SEC_H

    # ── Column header ──
    xs = col_xs()
    for ci, (label, x) in enumerate(zip(COLS, xs)):
        w = COL_W[ci] * USABLE_W
        draw_rect(x, cursor_y - HDR_H, w, HDR_H, HEADER_BG, border=BORDER)
        draw_text(x + 0.005, cursor_y - HDR_H * 0.5, label,
                  MUTED, fs=7.2, bold=True, mono=False, va='center')
    cursor_y -= HDR_H

    # ── Data rows ──
    for ri, row in enumerate(sec['rows']):
        bg = ROW_EVEN if ri % 2 == 0 else ROW_ODD

        # cell colours per column
        cell_colors = [BLUE, AMBER, PURPLE, WHITE, GREEN, MUTED]
        cell_mono   = [False, True, True, False, True, True]
        cell_fs     = [8.2, 7.6, 7.5, 7.8, 7.6, 7.5]
        cell_bold   = [True, False, False, False, False, False]

        for ci, (text, x) in enumerate(zip(row, xs)):
            w = COL_W[ci] * USABLE_W
            draw_rect(x, cursor_y - ROW_H, w, ROW_H, bg)
            draw_text(x + 0.005, cursor_y - ROW_H * 0.5, text,
                      cell_colors[ci], cell_fs[ci],
                      bold=cell_bold[ci], mono=cell_mono[ci], va='center')
        cursor_y -= ROW_H

    cursor_y -= 0.004  # gap between sections

# ─── LEGEND ──────────────────────────────────────────────────────────────────
legend_items = [
    (BLUE,   'Metric Name'),
    (AMBER,  'Threshold / Target'),
    (PURPLE, 'Formula'),
    (WHITE,  'Description'),
    (GREEN,  'Source Tables'),
    (MUTED,  'Key Columns'),
]
lx = LEFT
for color, label in legend_items:
    draw_rect(lx, cursor_y - 0.010, 0.010, 0.007, color, border='none', lw=0)
    draw_text(lx + 0.012, cursor_y - 0.007, label, MUTED, fs=7.5, va='center')
    lx += 0.145

# Footer
fig.text(0.5, 0.006,
         'GrayQuest · platform_id=6 · IAM Analytics · 7 raw tables → 13 dx_* datasets · © 2026',
         ha='center', va='bottom', fontsize=7, color='#484F58', fontfamily='monospace')

# ─── SAVE ────────────────────────────────────────────────────────────────────
OUT = '/Users/ashutosh_bajpai/Desktop/Dashboard-Project/dashboard/metrics_reference_table.png'
plt.savefig(OUT, dpi=160, bbox_inches='tight',
            facecolor=BG, edgecolor='none')
plt.close()
print(f'Saved → {OUT}  ({total_rows} metrics across {len(SECTIONS)} sections)')
