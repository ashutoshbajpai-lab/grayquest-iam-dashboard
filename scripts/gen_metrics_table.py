"""
Generate a high-resolution metrics reference table image for the GrayQuest IAM Dashboard.
Output: metrics_reference_table.png
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import numpy as np

# ─── DATA ────────────────────────────────────────────────────────────────────

METRICS = [
    # (Metric Name, Threshold / Target, Formula, Description, Source Tables, Key Columns)
    (
        "Health Score",
        "≥ 60 Active\n40–59 At-Risk\n< 40 Alert",
        "0.4·login_rate + 0.3·(1-dormant)\n+ 0.2·session_norm + 0.1·mfa_score\n(min-max, 0–100)",
        "Composite user health\nacross 4 behavioural\ndimensions",
        "raw_iam_activities\nraw_iam_users",
        "user_id, action, status\ntimestamp, mfa_enabled",
    ),
    (
        "Login Success Rate",
        "≥ 90 % target\n< 70 % alert",
        "successful_logins /\ntotal_login_attempts × 100",
        "% of login attempts\nthat succeeded in\nthe last 30 days",
        "raw_iam_activities",
        "user_id, action\n(LOGIN), status",
    ),
    (
        "Active Sessions\n(30 d)",
        "Trend ↑ healthy\nDrop > 20 % alert",
        "COUNT DISTINCT session_id\nwhere gap > 3600 s\ndefines session boundary",
        "Unique user sessions\ndetected via 1-hour\ninactivity gap algorithm",
        "raw_iam_activities",
        "user_id, timestamp\n(session_id synthetic)",
    ),
    (
        "Dormant User %",
        "< 10 % target\n> 25 % alert",
        "users with 0 activity\nin last 30 d /\ntotal_users × 100",
        "Proportion of accounts\nwith no recorded action\nin rolling 30-day window",
        "raw_iam_activities\nraw_iam_users",
        "user_id, timestamp\nplatform_id",
    ),
    (
        "MFA Adoption\nRate",
        "≥ 80 % target\n< 50 % alert",
        "COUNT(mfa_enabled=true) /\ntotal_users × 100",
        "% of users who have\nmulti-factor authentication\nenabled on their account",
        "raw_iam_users",
        "user_id, mfa_enabled\nplatform_id",
    ),
    (
        "Service Failure\nRate",
        "< 5 % target\n> 10 % alert",
        "failed_calls /\ntotal_calls × 100\nper service",
        "% of API / service\ncalls that returned\na non-success status",
        "raw_iam_activities\nraw_iam_services",
        "service_id, status\n(FAILED/FAILURE)\ntimestamp",
    ),
    (
        "Avg Session\nDuration",
        "> 5 min healthy\n< 1 min suspicious",
        "SUM(session_end –\nsession_start) /\nCOUNT(sessions)",
        "Mean time a user\nspends in a single\nactive session",
        "raw_iam_activities",
        "user_id, timestamp\n(gap algorithm applied)",
    ),
    (
        "Privilege Escalation\nEvents",
        "0 target\n> 0 immediate alert",
        "COUNT(action =\n'PRIVILEGE_ESCALATION')\nper 30 d window",
        "Number of recorded\nprivilege-escalation\nevents in audit log",
        "raw_audit_logs\nraw_iam_events",
        "user_id, action\nevent_type, timestamp",
    ),
    (
        "Group Membership\nCoverage",
        "100 % target\n< 90 % alert",
        "users_in_at_least_1_group /\ntotal_users × 100",
        "% of users assigned\nto at least one IAM\naccess-control group",
        "raw_iam_user_groups\nraw_iam_users",
        "user_id, group_id\nplatform_id",
    ),
    (
        "Platform Activity\nIndex",
        "Baseline ± 15 %\nspike triggers alert",
        "total_events_today /\n30d_daily_avg",
        "Ratio of today's event\nvolume to the trailing\n30-day daily average",
        "raw_iam_activities\nraw_iam_events",
        "platform_id, timestamp\naction",
    ),
    (
        "Top-N User\nActivity Rank",
        "Display only\n(no threshold)",
        "RANK() OVER\n(ORDER BY sessions_30d\n+ actions_30d DESC)",
        "Ordinal rank of users\nby combined session count\nand total action count",
        "raw_iam_activities",
        "user_id, timestamp\naction, platform_id",
    ),
    (
        "Alert Severity\nScore",
        "0–3 Low\n4–6 Medium\n7–10 High",
        "weighted_sum(\n  threshold_breaches ×\n  severity_weight\n) / max_possible × 10",
        "0–10 composite score\ndriven by how many\nthresholds are breached",
        "derived (all\nmetrics above)",
        "all threshold breach\nflags, severity weights\nin config.ts",
    ),
]

COLS = ["Metric", "Threshold / Target", "Formula", "Description", "Source Tables", "Key Columns"]

# ─── LAYOUT ──────────────────────────────────────────────────────────────────

FIG_W, FIG_H = 28, 18
fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.set_axis_off()

# Background gradient
grad = np.linspace(0, 1, 256).reshape(1, -1)
ax.imshow(grad, aspect='auto', extent=[0, FIG_W, 0, FIG_H],
          cmap='Blues', alpha=0.06, zorder=0)

fig.patch.set_facecolor('#0F1117')
ax.set_facecolor('#0F1117')

# ─── TITLE ───────────────────────────────────────────────────────────────────
fig.text(0.5, 0.965, 'GrayQuest IAM Analytics Dashboard',
         ha='center', va='top', fontsize=22, fontweight='bold',
         color='#FFFFFF', fontfamily='monospace')
fig.text(0.5, 0.948, 'Metrics Reference — Thresholds · Formulas · Source Tables · Key Columns',
         ha='center', va='top', fontsize=13, color='#8B9FC1', fontfamily='monospace')

# Accent line under title
fig.add_artist(plt.Line2D([0.04, 0.96], [0.938, 0.938],
               transform=fig.transFigure, color='#3B82F6', linewidth=1.5, alpha=0.7))

# ─── TABLE GEOMETRY ──────────────────────────────────────────────────────────
# Column widths (fractions of figure width)
col_fracs = [0.135, 0.125, 0.175, 0.165, 0.155, 0.155]  # sums to ~0.91
left_margin = 0.045
top_y = 0.91      # figure coords
row_height = 0.060
header_height = 0.035

NROWS = len(METRICS)

# Convert to axes coords isn't needed — we'll draw in figure coords with fig.add_axes patches

# ─── PALETTE ─────────────────────────────────────────────────────────────────
HEADER_BG   = '#1E3A5F'
HEADER_FG   = '#93C5FD'
ROW_EVEN    = '#141820'
ROW_ODD     = '#1A1F2E'
CELL_BORDER = '#2D3748'
TXT_PRIMARY = '#E2E8F0'
TXT_MUTED   = '#8B9FC1'
ACCENT      = '#3B82F6'
WARN        = '#F59E0B'
DANGER      = '#EF4444'
SUCCESS     = '#10B981'

# ─── HELPER: draw cell ───────────────────────────────────────────────────────
def cell(fig, x, y, w, h, bg, text, color, fontsize=8.5, bold=False, mono=False, valign='center'):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle='square,pad=0',
                          linewidth=0.5, edgecolor=CELL_BORDER,
                          facecolor=bg, transform=fig.transFigure, zorder=2)
    fig.add_artist(rect)
    tx = x + w * 0.5
    ty = y + h * 0.5
    fw = 'bold' if bold else 'normal'
    ff = 'monospace' if mono else 'DejaVu Sans'
    fig.text(tx, ty, text, ha='center', va='center',
             fontsize=fontsize, color=color, fontweight=fw, fontfamily=ff,
             multialignment='center', transform=fig.transFigure,
             wrap=False, zorder=3)

# ─── HEADER ──────────────────────────────────────────────────────────────────
x = left_margin
for ci, (label, frac) in enumerate(zip(COLS, col_fracs)):
    w = frac * 0.91
    cell(fig, x, top_y, w, header_height, HEADER_BG, label, HEADER_FG,
         fontsize=9.5, bold=True)
    x += w

# ─── ROWS ────────────────────────────────────────────────────────────────────
for ri, row_data in enumerate(METRICS):
    y = top_y - header_height - ri * row_height
    bg = ROW_EVEN if ri % 2 == 0 else ROW_ODD
    x = left_margin
    for ci, (text, frac) in enumerate(zip(row_data, col_fracs)):
        w = frac * 0.91
        # Column-specific styling
        if ci == 0:   # Metric name
            color = '#93C5FD'
            fs = 8.5
            bold = True
            mono = False
        elif ci == 1:  # Threshold
            color = WARN
            fs = 8.0
            bold = False
            mono = True
        elif ci == 2:  # Formula
            color = '#A5B4FC'
            fs = 7.8
            bold = False
            mono = True
        elif ci == 3:  # Description
            color = TXT_PRIMARY
            fs = 8.2
            bold = False
            mono = False
        elif ci == 4:  # Source tables
            color = SUCCESS
            fs = 8.0
            bold = False
            mono = True
        else:          # Key columns
            color = TXT_MUTED
            fs = 8.0
            bold = False
            mono = True

        # Left-align text cells (except header which is centered)
        rect = FancyBboxPatch((x, y), w, row_height,
                              boxstyle='square,pad=0',
                              linewidth=0.5, edgecolor=CELL_BORDER,
                              facecolor=bg, transform=fig.transFigure, zorder=2)
        fig.add_artist(rect)

        # Left-pad text
        tx = x + 0.008
        ty = y + row_height * 0.5
        fw = 'bold' if bold else 'normal'
        ff = 'monospace' if mono else 'DejaVu Sans'
        fig.text(tx, ty, text, ha='left', va='center',
                 fontsize=fs, color=color, fontweight=fw, fontfamily=ff,
                 multialignment='left', transform=fig.transFigure,
                 zorder=3)
        x += w

# ─── LEGEND ──────────────────────────────────────────────────────────────────
legend_y = top_y - header_height - NROWS * row_height - 0.035
patches = [
    mpatches.Patch(color='#93C5FD', label='Metric Name'),
    mpatches.Patch(color=WARN,      label='Threshold / Target'),
    mpatches.Patch(color='#A5B4FC', label='Formula (monospace)'),
    mpatches.Patch(color=TXT_PRIMARY, label='Description'),
    mpatches.Patch(color=SUCCESS,   label='Source Tables'),
    mpatches.Patch(color=TXT_MUTED, label='Key Columns'),
]
fig.legend(handles=patches, loc='lower center',
           bbox_to_anchor=(0.5, 0.005), ncol=6,
           frameon=True, framealpha=0.15,
           facecolor='#1A1F2E', edgecolor=CELL_BORDER,
           fontsize=8, labelcolor='white')

# Footer
fig.text(0.5, 0.015, f'GrayQuest · platform_id=6 · PLATFORM: IAM Analytics · Data window: rolling 30 days · © 2026',
         ha='center', va='bottom', fontsize=7.5, color='#4B5563',
         fontfamily='monospace')

# ─── SAVE ────────────────────────────────────────────────────────────────────
OUT = '/Users/ashutosh_bajpai/Desktop/Dashboard-Project/dashboard/metrics_reference_table.png'
plt.savefig(OUT, dpi=180, bbox_inches='tight',
            facecolor='#0F1117', edgecolor='none')
plt.close()
print(f'Saved → {OUT}')
