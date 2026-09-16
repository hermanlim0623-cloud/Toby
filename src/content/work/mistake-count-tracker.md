---
title: Mistake Count Tracker
tag: Tracking
order: 5
summary: Lightweight tool for logging and tracking recurring operational mistakes so patterns can be caught early.
impact: Surfaces recurring issues faster
stack: [Automation, Logging]
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Logging cost
    value: Seconds
  - label: Output
    value: Patterns, not blame
  - label: Horizon
    value: Trend over time
machine:
  input: Mistakes logged in seconds
  process: Count and group by kind
  decision: Frequency over drama
  output: Recurring patterns, surfaced early
---

## The problem

Operational mistakes were remembered, not recorded. Which means they were
remembered selectively — the dramatic one from last Tuesday stayed vivid, and
the small one that quietly happened eleven times did not. Without a record, the
loudest incident sets the agenda instead of the most frequent one.

## What I built

A deliberately lightweight log. Recording a mistake takes seconds, because
anything that takes longer than seconds doesn't get recorded during a busy
service — and a tracker with gaps in it is worse than useless, since it makes
the gaps look like zeroes.

## The thing it's careful about

It counts categories, not people. The moment a log like this becomes a record
of who is at fault, it stops being filled in honestly, and an incomplete log
produces confidently wrong conclusions. Tracking the *type* of mistake keeps
the incentive pointed at fixing the process.

## Result

Patterns that used to take months to notice — a step that's systematically
error-prone, a time of day where errors cluster — became visible in the trend.
That's the point: the tracker doesn't fix anything itself, it just makes the
thing worth fixing obvious enough to argue about with data.
