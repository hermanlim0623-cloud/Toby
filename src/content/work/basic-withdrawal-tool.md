---
title: Basic Withdrawal Tool
tag: Internal tool
order: 7
summary: A small internal tool that records withdrawals in one fixed shape, with the fields that make a record auditable required rather than optional.
capabilities: [Internal tooling, Operational systems]
use: Withdrawal record keeping
before: Records kept in whatever format each person preferred, individually fine, collectively unreconcilable.
after: One shape, enforced on entry, so reconciliation is reading rather than reconstruction.
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Records
    value: Uniform
  - label: Trail
    value: Auditable
  - label: Surface
    value: Deliberately small
machine:
  input: Withdrawal records
  process: One format, enforced on entry
  decision: Uniform over personal preference
  output: A trail that reconciles
---

## The problem

Withdrawal records were being kept in whatever format the person keeping them
preferred. Each format was individually fine. Collectively they were
unreconcilable, and money records that can't be reconciled are the ones that
turn into an afternoon of archaeology the moment anyone asks a question about
them.

## What I built

A small internal tool that records withdrawals in one fixed shape, with the
fields that make a record auditable (what, when, how much, by whom) required
rather than optional.

## How it works

The format is enforced at entry rather than corrected afterwards. A record
that is missing one of those four fields cannot be saved, which is the only
point at which enforcing it costs nothing.

## Technical approach

There was an obvious temptation to grow this into approvals, roles, and a
reporting layer. I didn't, because every feature added to a tool that touches
money is a new way for the record to be wrong, and the actual problem was never
"we need more capability". It was "we need the same capability, spelled the
same way every time."

A tool this small can be fully understood by the person using it. That property
is worth more here than any feature I could have added.

## Current state

In use. Withdrawal records are uniform and traceable, and reconciliation went
from reconstruction to reading.
