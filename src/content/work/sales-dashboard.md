---
title: Sales Dashboard
tag: Dashboard
order: 1
summary: Consolidates the day's order records into one daily and monthly view, written back into the spreadsheet the team already uses.
stack: [Python, Google Sheets API]
capabilities: [Automation, Data processing, Reporting]
use: Daily and monthly sales reporting
before: A nightly recap typed by hand from the day's order slips, about half an hour.
after: The same sheet, written by a job instead of typed by a person.
role: Design, build, and day-to-day maintenance
timeframe: Ongoing
status: In use
metrics:
  - label: Recap
    value: Typed → written
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
on. Typos in that recap didn't announce themselves. They just quietly became
the record.

## What I built

A Python job that reads the raw order data, normalizes it, and writes a
structured daily and monthly view back through the Google Sheets API, into
the same spreadsheet the team already trusted, so nothing had to be relearned.

## How it works

- **Ingest**: the day's records are pulled and parsed into a consistent shape,
  whatever shape they arrived in.
- **Normalize**: dates, item names and amounts get canonicalized, because the
  same item does not always arrive spelled the same way.
- **Aggregate**: daily totals roll into a monthly view, with the comparison
  period worked out rather than hand-selected.
- **Write back**: the Sheets API updates the ranges in place, so existing
  formulas, references and habits keep working.

## Technical approach

The deliberate decision was to write into the team's spreadsheet rather than
build a separate interface. A new dashboard would have been easier to build
and harder to adopt: the sheet was already open on someone's screen every day,
already linked to by other documents, already understood. Automating the input
to a tool people use beats introducing a tool they have to remember to open.

Writing in place rather than replacing the sheet is what makes that safe. The
job updates ranges, so anything built on top of those ranges survives the
update.

## Current state

In daily use, and maintained as the operation changes: new item names and
changed categories land in the normalization step rather than in a person's
head.
