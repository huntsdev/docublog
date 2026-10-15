---
title: Detection Notebook
description: A starter collection of defensive hypotheses, test observations, and analyst-facing explanations.
status: In progress
stack: [Markdown, YAML, Git]
featured: false
---

A place to keep the reasoning around a detection alongside its technical definition. The notebook connects a hypothesis to a test, an observation, and an explanation for its reviewer.

**Illustrative starter project:** this is a project outline, not a deployed detection library. Add real test results and repository links as the work becomes available.

## Why a notebook?

A query alone rarely captures why a rule exists or which assumptions make it useful. A short, consistent note can preserve the data requirements, the controlled test, and the expected review process.

The proposed format is plain Markdown and YAML so that changes are easy to review in version control.

## A useful entry

```yaml
title: Example configuration change review
state: draft
environment: authorized lab
data_requirements:
  - Service audit events
  - System identity
review_notes:
  - Compare with the approved change window
```

This example describes planning metadata. It is not a detection query or a supported rule format.

| Section | Purpose |
| --- | --- |
| Hypothesis | Explain the behavior of interest |
| Data requirements | State what must be collected |
| Test record | Preserve the action and observed evidence |
| Review guidance | Give the analyst a useful next step |
| Limitations | Keep unresolved assumptions visible |

## Working principles

Tests should use controlled, authorized environments. Entries should distinguish what the data demonstrates from what still requires investigation. Sensitive logs and internal system details need appropriate handling before anything is published.

## Next steps

Write one complete entry and ask another person to follow its review guidance. Use the feedback to improve the template before adding more examples.

For a practical example of collecting security telemetry, see [the SIEM home lab write-up](/blog/soclab/).
