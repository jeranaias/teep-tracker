# TEEP Tracker

Universal roster and qualification tracking tool for Marines. Solves the "Excel TEEP dies when the creator PCSes" problem by providing a portable, browser-based solution with data export/import capabilities.

## Features

- **Import from Multiple Sources**: Supports MOL, MCTIMS, MarineNet exports (CSV/Excel) with intelligent column mapping
- **Qualification Tracking**: Track PFT, CFT, rifle qual, licenses, annual training, medical readiness, PME, and more
- **Expiration Alerts**: Dashboard shows overdue and upcoming expirations at a glance
- **Find Qualified Personnel**: Query builder to find Marines matching specific qualification requirements
- **EAS-Aware Licenses**: Motor T licenses automatically expire at EAS if earlier than standard expiration
- **Reports**: Generate PDF/CSV reports for full roster, training matrix, license roster, and more
- **Offline Support**: PWA with service worker for offline access
- **Turnover Ready**: Export complete data as JSON for easy handoff to the next person

## Qualification Cycle Types

- **Calendar Window**: PFT (Jan-Jun), CFT (Jul-Dec)
- **Fiscal Year**: Rifle qual, annual training (Oct-Sep)
- **Rolling**: Licenses (4 years), swim qual (2 years), PHA (1 year)
- **One-Time**: MCMAP belts, PME

## Quick Start

1. Open `index.html` in your browser
2. Click **Import Data** to upload your roster (CSV/Excel from MOL, MCTIMS, etc.)
3. Map columns to fields (auto-detection helps)
4. Start tracking qualifications and monitoring expirations

## Data Storage

All data is stored locally in your browser using IndexedDB. No data is sent to any server.

## Turnover Process

1. Before you PCS, click **Export** → **Export Full Backup (JSON)**
2. Give the JSON file to your relief
3. They click **Import** and upload the JSON to continue where you left off

## Part of USMC Tools

This tool is part of the [USMC Tools](https://github.com/jeranaias/usmc-tools) collection of free, offline-capable tools for Marines.

## License

MIT License - Free for all Marines to use and modify.
