"""
Complete metrics reference table — every KPI card and chart across all dashboard pages.
Output: metrics_reference_table.png
"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

BG         = '#0D1117'
HEADER_BG  = '#161B22'
SECTION_BG = '#1C2333'
ROW_EVEN   = '#0D1117'
ROW_ODD    = '#111827'
BORDER     = '#30363D'
WHITE      = '#E6EDF3'
MUTED      = '#8B949E'
BLUE       = '#58A6FF'
GREEN      = '#3FB950'
AMBER      = '#D29922'
RED        = '#F85149'
PURPLE     = '#BC8CFF'
CYAN       = '#39D0D8'
ORANGE     = '#FFA657'
PINK       = '#FF7EB6'

# ── Each row: (Name, Threshold/Target, Formula/Source, Description, Data Source, Key Fields) ──
SECTIONS = [
  {
    'title': 'PAGE: PEOPLE  —  KPI Cards',
    'color': BLUE,
    'rows': [
      ('Active Users\n(period KPI)',
       'Trend ↑ healthy\nDrop >20 % alert',
       'COUNT DISTINCT users\nwith platform_id=6\nactivity in period',
       'Users with any LOGIN\nin selected date range\n(Today / 7d / 30d / custom)',
       'raw_iam_activities',
       'user_id, type=LOGIN\ncreated_on, platform_id'),
      ('Avg Health Score\n(KPI card)',
       '≥60 Active\n40–59 At-Risk\n<40 Alert',
       'AVG(health_score)\nacross filtered\nactive users',
       'Mean composite health\nscore for all users\nvisible in current filter',
       'derived: raw_iam_activities\nraw_audit_logs',
       'user_id, health_score\n(min-max normalised)'),
      ('New Activations\n(KPI card)',
       'Growth ↑ positive',
       'COUNT users where\nfirst_seen BETWEEN\nperiod_start AND end',
       'Users whose very first\nLOGIN falls within the\nselected date range',
       'raw_iam_activities',
       'user_id, created_on\n(MIN per user = first_seen)'),
      ('Session Rate\n(KPI card)',
       '≥90 % target\n<70 % alert',
       'successful_logins /\n(logins + invalid_logins)\n× 100',
       'Auth success % for\nfiltered users — same as\nlogin success rate',
       'raw_iam_activities',
       'user_id, type\nLOGIN / INVALID LOGIN'),
      ('Total Sessions\n(KPI card)',
       'Trend ↑ healthy',
       'SUM(sessions_30d)\nfor all filtered users\n(pre-computed per user)',
       'Aggregate session count\nfor filtered user set;\nsubtitle shows total events',
       'raw_iam_activities\n(session gap algorithm)',
       'user_id, created_on\n3600s inactivity = new sess'),
    ],
  },
  {
    'title': 'PAGE: PEOPLE  —  Charts',
    'color': BLUE,
    'rows': [
      ('Activity Trend\n(Line chart)',
       'No hard threshold\nTrend shape matters',
       'Daily COUNT of\nDAU / sessions / events\nover selected period',
       'Toggle between Daily\nActive Users, sessions\nstarted, or events fired',
       'raw_iam_activities\nraw_audit_logs',
       'created_on (daily bucket)\nuser_id, session_id'),
      ('Active Roles\n(Donut chart)',
       'No threshold\n(distribution view)',
       'COUNT DISTINCT user_id\nGROUP BY primary_role\n÷ total × 100',
       'Breakdown of active users\nby their primary IAM role\n(first group assignment)',
       'raw_iam_user_groups\nraw_iam_groups',
       'user_id, group_id\ngroup.name (role label)'),
      ('Cohort Retention\n(Heatmap chart)',
       'W1 >60 %\nW2 >50 %\nW4 >40 %\nM2 >30 %  M3 >25 %',
       'active_in_period /\ncohort_size × 100\nper (cohort_month × period)',
       'Heatmap: rows = monthly\ncohorts, columns = W1/W2/\nW4/M2/M3 return periods',
       'raw_iam_activities',
       'user_id, created_on\nfirst_seen (cohort month)'),
      ('Engagement Depth\nby Role (Line chart)',
       '>3 events/sess healthy\n1 = login-only bounce',
       'AVG(audit_events /\nsession) GROUP BY\nprimary_role',
       'Average actions per\nsession for each role;\nhigher = deeper platform use',
       'raw_audit_logs\nraw_iam_activities',
       'session_id, user_id\nrole, event count'),
    ],
  },
  {
    'title': 'PAGE: PLATFORM HEALTH  —  KPI Cards',
    'color': RED,
    'rows': [
      ('Overall Success\n(KPI card)',
       '≥95 % target\n<90 % alert',
       'SUCCESS_events /\ntotal_audit_events\n× 100 (window)',
       'Platform-wide success rate\nacross all audit events in\nselected time window (1d/7d/30d)',
       'raw_audit_logs',
       'status (SUCCESS/FAIL)\ncreated_on, platform_id'),
      ('Failed Events\n(KPI card)',
       '0 ideal\n>50 / window alert',
       'COUNT audit_logs\nwhere status IN\n(FAILED, FAILURE)',
       'Total failed audit events\nin selected window; subtitle\nshows Today / 7d / 30d',
       'raw_audit_logs',
       'status, service_id\ncreated_on'),
      ('Avg Session\n(KPI card)',
       '>5 min healthy\n<1 min suspicious',
       'AVG(session_end −\nsession_start) ÷ 60\nacross all sessions',
       'Mean session duration\nin minutes for selected\ntime window',
       'raw_iam_activities\n(session gap algorithm)',
       'user_id, created_on\nsession start / end'),
      ('Cross-Module Rate\n(KPI card)',
       '>30 % healthy\n<15 % alert',
       'sessions using ≥3\ndistinct service_ids /\ntotal_sessions × 100',
       'Breadth of platform use —\n% of sessions where user\ntouched 3+ modules',
       'raw_audit_logs',
       'session_id, service_id\n(≥3 distinct per session)'),
    ],
  },
  {
    'title': 'PAGE: PLATFORM HEALTH  —  Charts  +  Inline Stats',
    'color': RED,
    'rows': [
      ('Success Rate Trend\n(Line chart)',
       'Δ ≥ 0 healthy\nΔ < −2 % alert',
       'Daily overall_success_rate\nplotted over 30-day window\nor custom range',
       'Time-series of platform\nsuccess rate; shows\npattern of degradation',
       'raw_audit_logs',
       'status, created_on\n(daily bucket)'),
      ('Login Funnel\n(Funnel chart)',
       'Each step ≥95 %\nof previous step',
       'Attempt → Auth Pass\n→ Session → Action\n(4-step funnel counts)',
       'Conversion funnel:\nhow many login attempts\nprogress to real actions',
       'raw_iam_activities\nraw_audit_logs',
       'type=LOGIN/INVALID\nsession_id, audit linkage'),
      ('Auth Success %\n(inline stat)',
       '≥95 % target\n<90 % alert',
       'LOGIN / (LOGIN +\nINVALID_LOGIN) × 100\nfor window',
       'Login success rate shown\nas inline stat beside\nthe funnel chart',
       'raw_iam_activities',
       'type, created_on\nwindow filter'),
      ('Session Completion %\n(inline stat)',
       '>80 % target\n<60 % alert',
       'sessions WITH ≥1\naudit action / total\nsessions × 100',
       'Shown beside funnel;\n% of sessions that\nincluded a real action',
       'raw_iam_activities\nraw_audit_logs',
       'session_id\naudit event linkage'),
      ('Bounce Rate\n(inline stat)',
       '<20 % target\n>40 % alert',
       '(sessions − sessions\nwith actions) /\ntotal × 100',
       'Shown in red beside\nfunnel; login-only\nsessions with no action',
       'raw_iam_activities\nraw_audit_logs',
       'session_id\naction count per session'),
      ('Session Duration\nDistribution (Bar chart)',
       '<1 min bucket\n<20 % healthy',
       'COUNT sessions bucketed\ninto: <1m / 1–5m / 5–15m\n/ 15–30m / >30m',
       'Histogram of session\nlengths; spike in <1 min\nbucket = bounce problem',
       'raw_iam_activities\n(session gap algorithm)',
       'session duration_sec\nbucket labels'),
      ('Failure Rate by Event\n(Horizontal bar chart)',
       '<5 % per event\n>10 % = investigate',
       'failed_events /\ntotal_events × 100\nper event_type',
       'Ranks event types by\nfailure %; identifies\nspecific broken actions',
       'raw_audit_logs\nraw_iam_events',
       'event_id, status\nevent.label'),
    ],
  },
  {
    'title': 'PAGE: SERVICES  —  KPI Cards',
    'color': GREEN,
    'rows': [
      ('Active Services\n(KPI card)',
       'Stable count healthy\ndrop >2 alert',
       'COUNT DISTINCT\nservice_id with ≥1\naudit event in window',
       'Number of distinct IAM\nmodules used in the\nselected time window',
       'raw_audit_logs\nraw_iam_services',
       'service_id\ncreated_on'),
      ('Total Volume\n(KPI card)',
       'Baseline ±30 %\nnormal variation',
       'COUNT all audit_logs\nfor active services\nin window',
       'Total events processed\nacross all services;\nshows platform load',
       'raw_audit_logs',
       'service_id\ncreated_on'),
      ('Success Rate\nWeighted (KPI card)',
       '≥95 % target\n<90 % alert',
       'SUM(ok_events) /\nSUM(total_events)\n× 100  (weighted)',
       'Volume-weighted success\nrate across all services;\nbig services count more',
       'raw_audit_logs',
       'service_id, status\ncreated_on'),
      ('Top Service\n(KPI card)',
       'Display only\n(no threshold)',
       'service with MAX\nevents_30d in\ncurrent window',
       'Name of highest-volume\nservice; subtitle shows\nits event count',
       'raw_audit_logs\nraw_iam_services',
       'service_id, service.name\nCOUNT events'),
      ('Report Exports\n(KPI card)',
       'Trend tracked\nno hard threshold',
       'COUNT events where\ntype IN (REPORT,\nREPORT-ALL-GILE)',
       'Total report-generation\nevents across all services\nin the selected window',
       'raw_audit_logs',
       'service_id, type\ncreated_on'),
    ],
  },
  {
    'title': 'PAGE: SERVICES  —  Charts  +  Drill-down',
    'color': GREEN,
    'rows': [
      ('Traffic Heatmap\n(Heatmap chart)',
       'Spike >3σ = alert',
       'COUNT audit_logs\nper (service_id × hour)\nbucket, last 30d',
       'Service × hour-of-day\nmatrix showing peak\nusage patterns',
       'raw_audit_logs',
       'service_id, created_on\nHOUR(created_on)'),
      ('Top Events\n(Horizontal bar chart)',
       'No hard threshold\n(volume ranking)',
       'COUNT events\nGROUP BY event_label\nfor selected service',
       'Most frequent event\ntypes within a service;\nshown in drill-down panel',
       'raw_audit_logs\nraw_iam_events',
       'service_id, event_id\nevent.label, COUNT'),
      ('Service Success Rate\n(Horizontal bar chart)',
       '≥95 % per service\n<90 % = banner',
       'SUCCESS / total\n× 100 per service_id\nfor selected window',
       'Per-service success\nrate ranked lowest\nfirst for triage',
       'raw_audit_logs',
       'service_id, status\nCOUNT grouped'),
      ('Service Trend\n(drill-down)',
       'Δ ≥ 0 growing\nΔ < −20 % alert',
       '(events_cur − events_prev)\n/ events_prev × 100\nper service',
       'MoM or period-over-period\nchange in event volume\nper service',
       'raw_audit_logs',
       'service_id, created_on\n(two period windows)'),
      ('Report Export Rate\n(drill-down stat)',
       'Trend tracked',
       'report_events /\ntotal_events × 100\nper service',
       'Share of a service\'s\nevents that are report\nexports vs regular actions',
       'raw_audit_logs',
       'service_id, type\nREPORT / total ratio'),
    ],
  },
  {
    'title': 'PAGE: METRICS BUILDER  —  Custom & Pinned',
    'color': CYAN,
    'rows': [
      ('Custom Metric\nFormula Result',
       'User-defined\nthreshold',
       'User formula evaluated\nvia /api/metrics/compute\nwith Gemini AI assist',
       'Any expression the analyst\nwrites in the builder; result\ncached per formula string',
       'any dx_* snapshot\nor raw table API',
       'formula (string)\nresult (string)'),
      ('Pinned Metrics\n(per section)',
       'Inherits threshold\nfrom formula',
       'Same formula stored\nin metricsStore;\nre-evaluated on demand',
       'Saved custom metrics\npinned to People / Services\n/ Health / Chat sections',
       'Zustand metricsStore\n(localStorage persist)',
       'id, name, formula\npinnedTo[] sections'),
    ],
  },
  {
    'title': 'CROSS-PAGE  —  User Drawer KPIs (per-user detail)',
    'color': ORANGE,
    'rows': [
      ('User Health Score\n(drawer badge)',
       '≥60 Active\n40–59 At-Risk\n<40 Alert',
       '(login_norm + action_norm\n+ module_norm + report_norm)\n÷ 4 × 100',
       'Individual user\'s composite\nhealth shown in drawer\nwhen row clicked',
       'raw_iam_activities\nraw_audit_logs',
       'user_id, all activity\nmin-max per platform'),
      ('Auth Success Rate\n(drawer stat)',
       '≥90 % healthy\n<70 % alert',
       'LOGIN / (LOGIN +\nINVALID_LOGIN) × 100\nper user',
       'Per-user login success\nrate shown in the\nuser detail drawer',
       'raw_iam_activities',
       'user_id, type\nLOGIN / INVALID LOGIN'),
      ('Sessions — 30 d\n(drawer stat)',
       '>2 /month healthy\n0 = dormant',
       'COUNT sessions\nwhere user_id=X\nAND ts ≥ today−30d',
       'Number of sessions\nthis user started in\nrolling 30-day window',
       'raw_iam_activities\n(session gap algorithm)',
       'user_id, created_on\n3600s gap boundary'),
      ('Events — 30 d\n(drawer stat)',
       '>5 healthy\n0 = inactive',
       'COUNT audit_logs\nwhere user_id=X\nAND ts ≥ today−30d',
       'Total audit actions\nthis user performed\nin rolling 30 days',
       'raw_audit_logs',
       'user_id, created_on'),
      ('Services Used\n(drawer stat)',
       '>2 services = active\n1 = narrow use',
       'COUNT DISTINCT\nservice_id in audit_logs\nper user (30d)',
       'Number of distinct\nIAM modules this user\naccessed in 30 days',
       'raw_audit_logs',
       'user_id, service_id\ncreated_on'),
      ('Cross-Module Rate\n(drawer stat)',
       '>30 % healthy\n<15 % alert',
       'sessions with ≥3\nservices / total\nsessions × 100',
       'Per-user breadth\nmetric shown in the\nuser detail drawer',
       'raw_audit_logs',
       'user_id, session_id\nservice_id (distinct)'),
      ('Last Active Date\n(drawer stat)',
       'Within 30d = active\n>30d = dormant',
       'MAX(created_on)\nwhere type=LOGIN\nAND user_id=X',
       'Most recent login\ndate for this user;\nused for dormancy flag',
       'raw_iam_activities',
       'user_id, type=LOGIN\ncreated_on (MAX)'),
      ('User Status\n(drawer badge)',
       'Active / At-Risk\n/ Inactive',
       'health ≥60 → Active\n40≤h<60 → At-Risk\nh<40 → Inactive',
       'Categorical tier derived\nfrom health score;\ncolour-coded in drawer header',
       'derived from\nHealth Score',
       'health_score vs\nconfig.ts HEALTH thresholds'),
    ],
  },
  {
    'title': 'CROSS-PAGE  —  Alerts Panel Thresholds',
    'color': PINK,
    'rows': [
      ('Health Score Alert',
       'avg_health < 60',
       'AVG(health_score)\nall active users\n< HEALTH.AVG_ALERT',
       'Fires when platform-wide\naverage health drops\nbelow 60 (configured threshold)',
       'derived from\nHealth Score KPI',
       'avg_health_score\nHEALTH.AVG_ALERT = 60'),
      ('Dormant Users Alert',
       'dormant_pct > 25 %',
       'dormant_users /\ntotal_users × 100\n> 25',
       'Fires when more than\n25 % of users have no\nactivity in 30 days',
       'raw_iam_activities\nraw_iam_users',
       'dormant_users\ntotal_users'),
      ('Success Rate Alert',
       'success_rate < 90 %',
       'overall_success_rate\n< 90 from health\nKPI snapshot',
       'Fires when platform\nsuccess rate drops\nbelow 90 %',
       'raw_audit_logs',
       'status, created_on\noverall_success_rate'),
      ('New Activations Alert',
       'new_activations\n= 0 (no growth)',
       'new_activations_30d\n= 0',
       'Fires when zero new\nuser activations in the\nlast 30-day window',
       'raw_iam_activities',
       'user_id, first_seen\ncreated_on (MIN per user)'),
    ],
  },
]

# ── Layout ────────────────────────────────────────────────────────────────────
COLS    = ['Metric / KPI', 'Threshold / Target', 'Formula / Calculation', 'Description', 'Source Table(s)', 'Key Columns']
COL_W   = [0.130, 0.108, 0.175, 0.195, 0.150, 0.172]   # must sum ≈ 0.93
LEFT    = 0.018
USABLE  = 0.964
ROW_H   = 0.0188
HDR_H   = 0.0120
SEC_H   = 0.0115

total_rows    = sum(len(s['rows']) for s in SECTIONS)
n_sections    = len(SECTIONS)
content_frac  = n_sections * (SEC_H + HDR_H) + total_rows * ROW_H + 0.08
FIG_W, FIG_H  = 34, max(24, content_frac * 34 / 0.94)

fig = plt.figure(figsize=(FIG_W, FIG_H))
fig.patch.set_facecolor(BG)
ax  = fig.add_axes([0, 0, 1, 1])
ax.set_axis_off(); ax.set_xlim(0, 1); ax.set_ylim(0, 1)

def rect(x, y, w, h, bg, ec=BORDER, lw=0.4, z=2):
    fig.add_artist(FancyBboxPatch((x,y), w, h, boxstyle='square,pad=0',
        linewidth=lw, edgecolor=ec, facecolor=bg,
        transform=fig.transFigure, zorder=z))

def txt(x, y, s, color, fs, bold=False, mono=False, ha='left', va='center'):
    fig.text(x, y, s, ha=ha, va=va, fontsize=fs, color=color,
             fontweight='bold' if bold else 'normal',
             fontfamily='monospace' if mono else 'DejaVu Sans',
             multialignment='left', transform=fig.transFigure, zorder=3)

def col_xs():
    xs, x = [], LEFT
    for f in COL_W:
        xs.append(x); x += f * USABLE
    return xs

# Title
TOP = 0.978
fig.text(0.5, TOP, 'GrayQuest IAM Analytics  —  Complete Metrics & KPI Reference',
         ha='center', va='top', fontsize=18, fontweight='bold', color=WHITE, fontfamily='monospace')
fig.text(0.5, TOP-0.017,
         f'All {total_rows} metrics · Every KPI card · Every chart · People / Health / Services / Metrics Builder  ·  platform_id=6',
         ha='center', va='top', fontsize=10, color=MUTED, fontfamily='monospace')
fig.add_artist(plt.Line2D([LEFT, LEFT+USABLE], [TOP-0.028, TOP-0.028],
    transform=fig.transFigure, color=BLUE, linewidth=1.2, alpha=0.55))

cy = TOP - 0.036

for sec in SECTIONS:
    sc   = sec['color']
    xs   = col_xs()

    # Section banner
    rect(LEFT, cy-SEC_H, USABLE, SEC_H, SECTION_BG, ec=sc, lw=1.1, z=2)
    rect(LEFT, cy-SEC_H, 0.004, SEC_H, sc, ec=sc, lw=0, z=3)
    txt(LEFT+0.006, cy-SEC_H*0.5, sec['title'], sc, 8.2, bold=True, mono=True)
    cy -= SEC_H

    # Column headers
    for ci, (label, x) in enumerate(zip(COLS, xs)):
        w = COL_W[ci] * USABLE
        rect(x, cy-HDR_H, w, HDR_H, HEADER_BG)
        txt(x+0.004, cy-HDR_H*0.5, label, MUTED, 7.0, bold=True)
    cy -= HDR_H

    # Rows
    CCOLS  = [BLUE, AMBER, PURPLE, WHITE, GREEN, MUTED]
    CMONO  = [False, True, True, False, True, True]
    CFS    = [8.0, 7.4, 7.3, 7.6, 7.4, 7.3]
    CBOLD  = [True, False, False, False, False, False]

    for ri, row in enumerate(sec['rows']):
        bg = ROW_EVEN if ri % 2 == 0 else ROW_ODD
        for ci, (cell, x) in enumerate(zip(row, xs)):
            w = COL_W[ci] * USABLE
            rect(x, cy-ROW_H, w, ROW_H, bg)
            txt(x+0.004, cy-ROW_H*0.5, cell, CCOLS[ci], CFS[ci],
                bold=CBOLD[ci], mono=CMONO[ci])
        cy -= ROW_H

    cy -= 0.004

# Legend
lx = LEFT
for color, label in [(BLUE,'Metric/KPI'),(AMBER,'Threshold'),(PURPLE,'Formula'),
                     (WHITE,'Description'),(GREEN,'Source Table'),(MUTED,'Key Columns')]:
    rect(lx, cy-0.009, 0.009, 0.006, color, ec='none', lw=0)
    txt(lx+0.011, cy-0.006, label, MUTED, 7.3)
    lx += 0.155

fig.text(0.5, 0.005,
    'GrayQuest · platform_id=6 · 7 raw tables → 13 dx_* datasets · All 4 dashboard pages covered · © 2026',
    ha='center', va='bottom', fontsize=6.8, color='#484F58', fontfamily='monospace')

OUT = '/Users/ashutosh_bajpai/Desktop/Dashboard-Project/dashboard/metrics_reference_table.png'
plt.savefig(OUT, dpi=155, bbox_inches='tight', facecolor=BG, edgecolor='none')
plt.close()
print(f'Saved → {OUT}  ({total_rows} rows, {len(SECTIONS)} sections)')
