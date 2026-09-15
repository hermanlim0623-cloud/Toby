---
title: Order Adjustment Bot
tag: Automation
world: bot
order: 3
summary: Automates repetitive order-adjustment entries that were previously handled manually, one by one.
impact: Removes a recurring manual task
stack: [Python, Scripting, Bots]
role: Design and build
timeframe: Ongoing
status: In use
metrics:
  - label: Entries
    value: Hand-typed → automatic
  - label: Failure mode
    value: Flags, never guesses
  - label: Runs
    value: Unattended
machine:
  input: Repetitive adjustment entries
  process: Apply the rules in a fixed order
  decision: Apply, or flag — never guess
  output: Adjusted records, unattended
---

## The problem

Order adjustments are the definition of work that shouldn't need a person:
the same handful of rules, applied over and over, to entries that differ only
in their numbers. A human doing it is slow, and worse, a human doing it at the
end of a shift is inconsistent. The hundredth adjustment gets less attention
than the first.

## What I built

A bot that applies the adjustment rules directly against the records — the
same rules, in the same order, every time, without getting tired near the end
of the batch.

## The design decision that mattered

The bot does not guess. Every case falls into one of three buckets:

1. **Matches a rule cleanly** — apply it and log what was done.
2. **Matches nothing** — leave it alone and flag it for a person.
3. **Matches ambiguously** — leave it alone and flag it, loudly.

Automation that silently does something plausible with an edge case is worse
than automation that stops. The whole value proposition is that you can stop
checking its work, and you can only stop checking if it's honest about what it
couldn't handle.

## Result

The recurring entry task is gone from the daily routine. What's left is a short
exception list — the cases that genuinely needed judgment — which is exactly
the part a person should have been spending their attention on all along.
