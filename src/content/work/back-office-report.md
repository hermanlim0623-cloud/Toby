---
title: Back Office Report
tag: Reporting
order: 4
summary: Structured back-office reporting tool that compiles operational data into a clean, shareable format.
impact: Standardized weekly reporting
stack: [Python, Reporting]
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Format
    value: Standardized
  - label: Assembly
    value: Automated
  - label: Cadence
    value: Weekly
machine:
  input: A week of operational data
  process: Assemble to a fixed shape
  decision: The layout is settled, not re-chosen
  output: Reports that read side by side
---

## The problem

Back-office reporting had no fixed shape. Each report was assembled from
whatever was to hand, in whatever layout made sense that week, which meant two
reports from two weeks couldn't be read side by side. Comparison — the entire
reason you write a weekly report — required re-reading both from scratch.

## What I built

A reporting tool that compiles operational data into one fixed structure. Same
sections, same order, same units, every week.

The boring consistency is the feature. A reader who has seen last week's report
already knows where to look in this one, so the report gets scanned in a minute
instead of studied for ten — and reports that take ten minutes to study are
reports that stop getting read.

## How it works

Data is pulled from the operational sources, validated (a missing section fails
loudly rather than silently rendering as a blank), grouped into the fixed
section layout, and written out as a clean shareable document.

## Result

Weekly reporting became a standing output rather than a weekly project. The
downstream effect is the useful one: because the format is stable, week-over-week
drift is visible at a glance instead of being something you have to go looking
for.
