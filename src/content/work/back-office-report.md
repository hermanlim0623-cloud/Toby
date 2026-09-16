---
title: Back Office Report
tag: Reporting
order: 4
summary: Compiles a week of operational data into one fixed structure, so consecutive reports can be read side by side.
stack: [Python]
capabilities: [Reporting, Data processing]
use: Weekly operational reporting
before: Each week's report assembled from whatever was to hand, in a new layout.
after: One fixed structure, so two weeks can be compared without re-reading both.
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
reports from two weeks couldn't be read side by side. Comparison (the entire
reason you write a weekly report) required re-reading both from scratch.

## What I built

A reporting tool that compiles operational data into one fixed structure. Same
sections, same order, same units, every week.

The boring consistency is the feature. A reader who has seen last week's report
already knows where to look in this one, so the report gets scanned in a minute
instead of studied for ten, and reports that take ten minutes to study are
reports that stop getting read.

## How it works

Data is pulled from the operational sources, validated, grouped into the fixed
section layout, and written out as a clean shareable document.

## Technical approach

Validation is the part worth naming: a missing section fails loudly rather
than silently rendering as a blank. A report with a quietly empty section is
more dangerous than a report that failed to build, because the empty section
reads as a zero. Failing the run puts the problem in front of someone while it
is still a data problem, rather than after it has become a decision made on a
number that was never there.

The layout is settled in code rather than chosen each week, which is what
makes week-over-week drift visible: the only thing that changes between two
reports is the data.

## Current state

In use on a weekly cadence. Reporting became a standing output rather than a
weekly project.
