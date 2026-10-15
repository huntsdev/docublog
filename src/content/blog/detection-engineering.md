---
title: Notes on detection engineering
description: Connect an observation, a data source, and a reviewable test before writing the alert.
date: 2026-08-14
tags: [Detection, Security, Engineering]
featured: false
---

A useful detection starts with a behavior somebody can explain. The query comes later, after you know what the data can actually show.

This is **illustrative starter content**. The process below is an example for authorized defensive testing and should be adapted to your environment.

## Write the hypothesis first

Describe the behavior you want to notice, the evidence it might leave, and the decision an analyst could make from that evidence. If the description depends on a field you do not collect, that is a data question to resolve first.

```yaml
name: Example service configuration change
purpose: Review unexpected changes to a lab service
data_source: Lab service audit events
review_context:
  - Change window
  - Responsible owner
  - Previous configuration
```

This is a planning sketch, not an executable detection rule.

## Test the observation

Use a controlled lab or an approved test procedure. Record the action, its timestamp, and the events you expected to find. Then compare that expectation with what arrived.

| Question | What the answer helps establish |
| --- | --- |
| Did the event arrive? | Collection coverage |
| Are the relevant fields populated? | Query feasibility |
| How often does normal work produce it? | Review volume |
| Can an analyst explain the result? | Operational usefulness |

## Carry the context into the alert

An alert should give its reviewer enough information to take a useful next step. Include the affected system, the observed change, and the assumptions behind the rule.

> A matching event is the beginning of a review, not the end of an investigation.

## Keep a change log

Record why a threshold changed, which test informed an exclusion, and what remains uncertain. Those notes make later tuning a reasoned decision.

The durable artifact is the combination of hypothesis, test, query, and review guidance. Keep them close enough that updating one prompts a look at the others.
