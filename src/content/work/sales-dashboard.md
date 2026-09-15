---
title: Sales Dashboard
tag: Dashboard
world: control
order: 1
summary: Daily and monthly sales overview for a food & beverage business, replacing manual recap spreadsheets with a live view of performance.
impact: Recap time cut from ~30 min to instant
stack: [Python, Sheets API, Automation]
role: Design, build, and day-to-day maintenance
timeframe: Ongoing
status: In use
metrics:
  - label: Recap time
    value: 30 min → 0
  - label: Manual re-entry
    value: Removed
  - label: Refresh
    value: Daily + monthly
machine:
  input: Raw order records
  process: Normalise and aggregate in Python
  decision: Which period a row belongs to
  output: The team's existing sheet, written not typed
---

## The problem

Every night closed the same way: someone sat down with the day's order slips
and typed the numbers into a spreadsheet by hand. It took about half an hour,
it happened after a full service when nobody is at their sharpest, and the
number that came out of it was the number the next day's decisions were made
on. Typos in that recap didn't announce themselves — they just quietly became
the record.

The deeper problem wasn't the thirty minutes. It was that nobody could answer
"how are we doing this month?" without first rebuilding the month.

## What I built

A Python job that reads the raw order data, normalizes it, and writes a
structured daily and monthly view back through the Google Sheets API — into
the same spreadsheet the team already trusted, so nothing had to be relearned.

The sheet stopped being a place where numbers get typed and became a place
where numbers appear.

## How it works

- **Ingest** — the day's records are pulled and parsed into a consistent shape,
  regardless of how messy the source rows are.
- **Normalize** — dates, item names and amounts get canonicalized, because the
  same product spelled three ways used to split into three lines.
- **Aggregate** — daily totals roll into a monthly view, with the comparison
  against the previous period computed rather than eyeballed.
- **Write back** — the Sheets API updates the ranges in place, so existing
  charts, filters and shared links keep working.

## Result

The nightly recap disappeared as a task. The monthly view exists at all times
instead of being assembled on request, and because the numbers come from the
source data rather than from re-typing, they agree with themselves.

The thing I'd call the real win: when a number looks wrong now, the question
is "what happened in the business?" — not "who mistyped it?"
