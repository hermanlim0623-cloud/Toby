---
title: Mistake Count Tracker
tag: Tracking
order: 5
summary: A lightweight log for recurring operational mistakes, counted by category so patterns show up in the trend rather than in memory.
capabilities: [Operational tracking, Logging, Data processing]
use: Operational mistake tracking
before: Mistakes remembered rather than recorded, which means remembered selectively.
after: A record where frequency is visible, not just the memorable incidents.
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
remembered selectively: the dramatic one from last Tuesday stayed vivid, and
the small one that quietly happened eleven times did not. Without a record, the
loudest incident sets the agenda instead of the most frequent one.

## What I built

A deliberately lightweight log. Recording a mistake takes seconds, because
anything that takes longer than seconds doesn't get recorded during a busy
service, and a tracker with gaps in it is worse than useless, since it makes
the gaps look like zeroes.

## How it works

Each entry is categorised by the kind of mistake rather than attached to a
person. Counts accumulate by category, and the useful output is the trend
across weeks rather than any individual row.

## Technical approach

The design constraint doing the real work here is speed of entry. Every field
added to the form is a reason not to fill it in mid-service, so the record
stays minimal on purpose: enough to count, not enough to become paperwork.

It counts categories, not people. The moment a log like this becomes a record
of who is at fault, it stops being filled in honestly, and an incomplete log
produces confidently wrong conclusions. Tracking the *type* of mistake keeps
the incentive pointed at fixing the process.

## Current state

In use. Patterns that used to take months to notice (a step that's
systematically error-prone, a time of day where errors cluster) became visible
in the trend. That's the point: the tracker doesn't fix anything itself, it
just makes the thing worth fixing obvious enough to argue about with data.
