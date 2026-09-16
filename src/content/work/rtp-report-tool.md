---
title: RTP Report Tool
tag: Reporting
order: 6
summary: Focused reporting utility built to track a specific recurring metric without manual recalculation each cycle.
impact: Removes manual recalculation
stack: [Python, Reporting]
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Recalculation
    value: Removed
  - label: Scope
    value: One metric, done right
  - label: Method
    value: Fixed, auditable
machine:
  input: Source figures
  process: One calculation, one method
  decision: The method is explicit, not a special case
  output: The same number every time
---

## The problem

One metric needed recomputing every cycle, by hand, using the same method every
time. Manual recalculation has a specific failure mode that's easy to miss: the
method drifts. Someone rounds at a different step, or includes a category the
last person excluded, and two cycles stop being comparable without anyone
noticing a mistake was made, because no mistake *was* made, exactly.

## What I built

A small, focused utility that does one calculation and does it identically
every time. Not a reporting platform. A tool with one job.

The narrow scope is intentional. This could have been folded into the general
back-office reporting, and it would have been worse: a metric with its own
specific method deserves its own explicit implementation, where the method is
readable in one place rather than buried as a special case inside something
general.

## Result

The recurring recalculation is gone, and more importantly the method is now
fixed and auditable. When someone asks "how is this number computed?", the
answer is a file, not a memory of how it was done last time.
