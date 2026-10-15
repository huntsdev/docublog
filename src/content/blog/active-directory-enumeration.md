---
title: A practical guide to Active Directory enumeration
description: Start with a question, collect only what you need, and turn directory data into useful documentation.
date: 2026-09-24
tags: [Active Directory, PowerShell, Security]
featured: true
---

Good enumeration begins with a question. A long list of objects is rarely useful on its own; a small, well-understood inventory can tell you where to spend your next hour.

This is **illustrative starter content** for hunts.dev. The workflow below is a read-only example for a directory you own or are authorized to administer. Replace the notes with observations from your environment before publishing.

## Decide what you need to learn

Start with the decision the inventory will support. Are you documenting group ownership, checking stale computer accounts, or preparing for a migration? Those are different questions, with different collections of attributes.

For a first pass, write down three things:

1. The systems and directory scope you are permitted to inspect.
2. The question your output should answer.
3. Where the resulting inventory will be stored and who can read it.

> Collecting more data is easy. Making that data understandable is the work.

## Build a small, repeatable inventory

In an administrative session with the Active Directory PowerShell module available, this example lists a few useful computer properties. It does not modify directory objects.

```powershell
# Run only against a directory you are authorized to inspect.
Get-ADComputer -Filter * -Properties OperatingSystem, LastLogonDate |
    Select-Object Name, OperatingSystem, LastLogonDate |
    Sort-Object Name |
    Export-Csv -Path .\computer-inventory.csv -NoTypeInformation
```

Keep the first query deliberately simple. Check a handful of records against information you already trust before treating the output as an inventory. A successful command is not proof that the data answers your original question.

If the directory is large, scope the collection to an appropriate organizational unit with `-SearchBase`. That makes the intent easier to review and helps keep the report focused.

## Give the output context

An export becomes much more useful when it travels with a short collection note.

| Field | What to record |
| --- | --- |
| Scope | The domain or organizational unit included |
| Collected | The date and time of the query |
| Purpose | The question the inventory supports |
| Limitations | Missing attributes or known reporting caveats |
| Owner | The person responsible for reviewing the results |

Treat logon timestamps as clues that require context, rather than a stand-alone reason to remove an account. Compare the report with system ownership, lifecycle records, and your organization's review process.

## Review before acting

Separate collection from decisions. Keep the original export, create a working copy, and record why a record needs attention. A useful finding usually includes an object, an observation, and a next step that somebody can own.

<details>
<summary>A lightweight review checklist</summary>

- Confirm the query scope matches the approved task.
- Check a sample of results for obvious omissions.
- Record empty properties rather than guessing their values.
- Store exports with the same care as other internal infrastructure data.
- Ask the responsible owner to review proposed changes.

</details>

## Leave a trail somebody can follow

The most reusable result is a short explanation beside the script: what it collects, why those fields matter, and what it deliberately leaves for a human to decide. Keep that explanation in version control alongside the query.

Microsoft's [Get-ADComputer documentation](https://learn.microsoft.com/en-us/powershell/module/activedirectory/get-adcomputer) is a useful reference for adapting the collection. For a companion example of keeping scripts tidy, see [PowerShell patterns worth keeping](/blog/powershell-patterns/).
