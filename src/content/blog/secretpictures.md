---
title: SecretPictures - HackTheBox Sherlock "Easy"
description: An in-depth writeup of the SecretPictures HackTheBox sherlock.
date: 2025-11-13
tags:
  - Malware
  - Malware Analysis
  - HackTheBox
  - Wireshark
featured: false
draft: false
image: https://i.imgur.com/9zS9B21.png
---

![solved](https://i.vgy.me/lQGDuE.png)

## Overview

This writeup details the analysis of SecretPictures, a Go-based malware that spreads via USB drives, establishes persistence through registry modifications, and communicates with a command-and-control server to exfiltrate system information and credentials.

## Sherlock - Secret Pictures

| Header 1 | Header 2 
|---|---
| Category | Malware Analysis 
| Rating  | 5 ⭐
| User Solves | 97

### Sherlock Scenario

The university's IT team began receiving reports of strange activity on library computers. Students noticed hidden files appearing on their USB drives and disappearing moments later. An investigation revealed a single suspicious file named "SecretPictures." When opened, it vanished instantly without leaving a trace, and no antivirus tool could identify it. The IT team isolated the file and provided it for your analysis. As a cybersecurity analyst, your task is to determine what this malware does, how it spreads, and how to stop it before it affects more systems.

### Lab Questions

1. What is the MD5 hash of the malware?
2. What programming language is used to write the malware?
3. What is the name of the folder the malware copies itself to after the initial run?
4. What registry key does the malware modify to achieve persistence?
5. What FQDN does the malware attempt to connect to?
6. Which Windows API function does the malware call to check drive types?
7. Which Go standard library function does the malware use to schedule periodic execution?
8. What encoding does the malware use to decode server responses?
9. The malware communicates with a backend server via a POST request. What are the names of the fields in the request body, separated by commas and listed alphabetically?



### Files Provided

```
SecretPictures.zip
└── secretPictures.exe
```

## Analysis

Unzipping the file from the zip, we can obtain the md5hash and utilize VirusTotal to gain more information on the malware.

```bash
┌─[✗]─[user@parrot]─[~/labs/htb/sherlocks/secretpictures]
└──╼ $md5sum secretPictures.exe 
[REDACTED]  secretPictures.exe
```

via [VirusTotal](https://www.virustotal.com/gui/file/80e82415a26ac7c0124bbaa2133192dadd51cbc5ed22b202ebb24f6fddf8c8ab/details) we can see that the file is indeed a malicious executable, which appears to be compiled in Go.

![virustotal-screenshot](https://i.vgy.me/Dm3aQe.png)

The malware copies itself after the inital run to `C:\Systemlogs\` and edits the `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run\HealthCheck` registry key to achieve persistence. 

The `secretpictures.exe` malware attempts a connection to `malware.invalid.com` and makes a Windows API call to `GetDriveType` via PowerShell to check the drive types.

The malware utilizes the [NewTicker](https://gobyexample.com/tickers) Go library function to schedule periodic exection and decode server responses through base64.

Once the executable is run, the malware makes a POST request to `malware.invalid.com/heist` capturing the workstation name, and device version.

![POST](https://i.vgy.me/grUBsE.png)

As mentioned previously, after the initial run of the malware, the malware reproduces itself into `C:\Systemlogs\` and runs on boot via the registry key `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run\HealthCheck` edited.

![reproduce](https://i.vgy.me/4ZxNBd.png)
![boot](https://i.vgy.me/lCcDDV.png)

There was also some POST requests of credentials being uploaded, and based on the data in the request, it looks to be credentials added onto the workstation for a new user is my assumption, possibly to elevate privileges or move laterally.

## Closing Thoughts 

This was a lot of fun, being able to gain intel on the malware through VirusTotal and then go straight into Malware Analysis for the last flag was very fun, I got stuck on the last flag, and was able to use fakenet-NG to simulate legitimate network services while intercepting all network traffic and logging it.


