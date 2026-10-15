---
title: Meerkat - HackTheBox Sherlock
author: Ryan Hunt
description: An in-depth writeup of the Meerkat HackTheBox sherlock.
date: 2025-11-11
tags:
  - SOC
  - Wireshark
  - Suricata
  - HackTheBox
featured: false
draft: false
image: https://0xdf.gitlab.io/icons/sherlock-meerkat.webp
---
![solved](https://i.imgur.com/y0gcIOf.png)

## Overview

For this HackTheBox Sherlock challenge, I investigated a compromised Bonitasoft business management platform by digging through Suricata alert logs and analyzing PCAP files. I found that the attacker started with a credential stuffing attack that eventually succeeded, then used an authorization bypass exploit (CVE-2022-25237) to upload a remote code execution "API extension". From there, they downloaded scripts from pastebin to add their SSH public key to the server's authorized_keys file, giving them persistent SSH access to the compromised system.

## Sherlock Scenario

As a fast-growing startup, Forela has been utilising a business management platform. Unfortunately, our documentation is scarce, and our administrators aren't the most security aware. As our new security provider we'd like you to have a look at some PCAP and log data we have exported to confirm if we have (or have not) been compromised.

## Sherlock Information

| Field | Value |
|-------|-------|
| Release Date | 13 November 2023 |
| Retire Date | 25 January 2024 |
| Difficulty | Easy |
| Category | SOC | 

## Sherlock Questions
1. We believe our Business Management Platform server has been compromised. Please can you confirm the name of the application running?
2. We believe the attacker may have used a subset of the brute forcing attack category - what is the name of the attack carried out?
3. Does the vulnerability exploited have a CVE assigned - and if so, which one?
4. Which string was appended to the API URL path to bypass the authorization filter by the attacker’s exploit?
5. How many combinations of usernames and passwords were used in the credential stuffing attack?
6. Which username and password combination was successful?
7. If any, which text sharing site did the attacker utilise?
8. Please provide the filename of the public key used by the attacker to gain persistence on our host.
9. Can you confirmed the file modified by the attacker to gain persistence?
10. Can you confirm the MITRE technique ID of this type of persistence mechanism?



## Files Provided
1. `meerkat.pcap` - network traffic capture
2. `meerkat-alerts.json` - suricata log data 

## Suricata Alert Events

At the time of completion, I didn't have any tools installed to parse .json effectively, I thought about utilziing Splunk but decided to manually dig through the .json. 

Analyzing the alerts brought me to an interesting signature related to [CVE-2022-25237](https://nvd.nist.gov/vuln/detail/CVE-2022-25237), which is an authorization bypass exploit to the [Bonitasoft](https://www.bonitasoft.com/) platform. Additionally noting that the source ip address is coming from `138.199.59.221`, which originates from Poland, however this could be spoofed through different proxies.

```json
{
        "ts": "2023-01-19T15:39:19.357536Z",
        "event_type": "alert",
        "src_ip": "138.199.59.221",
        "src_port": 53401,
        "dest_ip": "172.31.6.44",
        "dest_port": 8080,
        "vlan": null,
        "proto": "TCP",
        "app_proto": "http",
        "alert": {
            "severity": 1,
            "signature": "ET EXPLOIT Bonitasoft Authorization Bypass M1 (CVE-2022-25237)",
            "category": "Attempted Administrator Privilege Gain",
            "action": "allowed",
            "signature_id": 2036818,
            "gid": 1,
            "rev": 1,
            "metadata": [ REDACTED ]
                ....
```

Using Python, and Data Wranglers, I created a .py script to parse the Suricata .json file to get a better understanding of the most common signatures present through the alerts and work with some formatted data.

```python
import json
import pandas as pd

# import suricata json file
with open("meerkat-alerts.json", "r") as f:
    data = json.load(f)

# prepare list
records = []

for entry in data:
    # process alerts only
    if entry.get("event_type") == "alert":
        alert = entry.get("alert", {})
        metadata = alert.get("metadata", {})

        # extract CVE if not null
        cve_list = metadata.get("cve", [])
        cve = ", ".join(cve_list) if cve_list else None

        records.append({
            "timestamp": entry.get("ts"),
            "src_ip": entry.get("src_ip"),
            "src_port": entry.get("src_port"),
            "dest_ip": entry.get("dest_ip"),
            "dest_port": entry.get("dest_port"),
            "protocol": entry.get("proto"),
            "app_proto": entry.get("app_proto"),
            "signature": alert.get("signature"),
            "signature_id": alert.get("signature_id"),
            "severity": alert.get("severity"),
            "category": alert.get("category"),
            "action": alert.get("action"),
            "cve": cve,
            "community_id": entry.get("community_id")
        })

# convert to dataframe
df = pd.DataFrame(records)

# write detailed alerts to csv
df.to_csv("parsed_alerts.csv", index=False)

# count most common signatures
signature_counts = (
    df["signature"]
    .value_counts()
    .reset_index()
)

# rename columns 
signature_counts.columns = ["signature", "count"]

# add rank column
signature_counts["rank"] = signature_counts["count"].rank(method="dense", ascending=False).astype(int)

# export data file
signature_counts.to_csv("signature_ranking.csv", index=False)

# print on success 
print("\n Files written.")
```

![script&data](https://i.imgur.com/6ISeBoI.png)

## PCAP Data

To gain more information on the network traffic, we can analyze endpoints and protocol data, via Statistics > Endpoints, Statistics > Protocol Hierarchy.

![protocols](https://i.imgur.com/XXdFZaA.png)
![endpoints](https://i.imgur.com/ineY57X.png)

`172.31.6.44` we can see handles the most traffic, which also has a private ip address so this is more than likely the Bonitasoft IP address. All traffic utilizes IPv4 with common network protocols (HTTP, SSH, DNS, ARP, NTP, ICMP).

### Exploit 

![exploit](https://i.imgur.com/OTb1X6s.png)

As Task 4 mentions API URL paths, I started looking through HTML traffic and noticed some PUT methods to the `/bonitasoft/API/...` at `172.31.6.44` from ‎ `138.199.59.221` which I did some digging in and was able to identify appending `i18ntranslation` to the API PUT request, confirms the attempt of CVE-2022-25237, which followed by a status code of 200, confirms the bypassed authentication.

I am noting that this source IP address here is consistent with what was alerted in the Suricata logs. Based on the endpoint traffic data, this is the 6th ranked endpoint in terms of traffic volume, so worth noting the attacker may be rotating proxies to avoid detection.

### Credential Stuffing

Prior to the authentication bypass exploit, a series of POST events were made to the `bonita/loginservice` API, which all resulted in 401 (Unauthorized) indicating a credential stuffing attack.

| Field | Value |
|-------|-------|
| username=Clerc.Killich%40forela.co.uk&password=vYdwoVhGIwJ&_l=en | 401 
| username=Lauren.Pirozzi%40forela.co.uk&password=wsp0Uy&_l=en | 401
| username=Merna.Rammell%40forela.co.uk&password=u7pWoF36fn&_l=en | 401
| username=Gianina.Tampling%40forela.co.uk&password=maUIffqQl&_l=en | 401
| username=Konstance.Domaschke%40forela.co.uk&password=6XLZjvD&_l=en | 401
| username=Vida.Murty%40forela.co.uk&password=4ulecG&_l=en | 401
| username=Elka.Cavet%40forela.co.uk&password=n1aSdc&_l=en | 401
| username=Noam.Harvett%40forela.co.uk&password=VDt8bh&_l=en | 401
| username=Norbie.Bartolini%40forela.co.uk&password=GV2zlop&_l=en | 401
| username=Cariotta.Whife%40forela.co.uk&password=x3hoU0&_l=en | 401
| username=Mella.Amsberger%40forela.co.uk&password=4nIYM5WqN&_l=en | 401
| username=Cyndy.Element%40forela.co.uk&password=ybWxct&_l=en | 401
| [44 MORE USERNAMES REDACTED FOR LENGTH PURPOSES] | 401

After 56 credential stuffing attempts, a 204 is reached is finally reached at 3:38PM with the credentials `username=seb.broom%40forela.co.uk` **:**`password=g0vernm3nt`.

```http
username=seb.broom%40forela.co.uk&password=g0vernm3nt&_l=en
HTTP/1.1 204 
Set-Cookie: bonita.tenant=1; SameSite=Lax
Set-Cookie: JSESSIONID=0AD5E14F8D1AE496444835639D0E60A9; Path=/bonita; HttpOnly; SameSite=Lax
Set-Cookie: X-Bonita-API-Token=8b71f28f-31aa-47cb-92b6-50521cd5bf92; Path=/bonita; SameSite=Lax
Set-Cookie: BOS_Locale=en; Path=/; SameSite=Lax
Date: Thu, 19 Jan 2023 15:38:38 GMT
Keep-Alive: timeout=20
Connection: keep-alive
```

### Upload

The next series of events reveal following the 204, a remote code execution tool/plugin named `rce_api_extension.zip` was uploaded to the Bonitasoft server via post request: `POST /bonita/API/pageUpload;...`

![upload](https://i.imgur.com/iUUO2vF.png)

As you can see in the JSON below via contentType, this functions as something like a [REST API extension](https://documentation.bonitasoft.com/bonita/latest/api/rest-api-extensions) within Bonitasoft, which opens up the oppourtunity for remote code execution (RCE). 

```json
{
  "processDefinitionId": "",
  "updatedBy": "-1",
  "urlToken": "custompage_resourceNameRestAPI",
  "displayName": "RCE",
  "lastUpdateDate": "2023-01-19 15:38:52.798",
  "description": "REST API to manage resourceName",
  "creationDate": "2023-01-19 15:38:52.798",
  "contentName": "tmp_1743116099114333531.zip",
  "isHidden": "false",
  "createdBy": "",
  "isProvided": "false",
  "id": "132",
  "contentType": "apiExtension"
}
```
Immediately after the RCE upload, a GET request is made to `/bonita/API/extension/rce` and downloads a script from another pastebin links and runs that script on `/home/ubuntu/.ssh/authorized_keys`. 

![pastebin](https://i.imgur.com/Gp0AZpV.png)
![nested-pastebin](https://i.imgur.com/HB1yH2k.png)

By doing so, if the attacker has the private key, and the file uploaded to &nbsp; `authorized_keys` is the public key, the attacker can now SSH into the Bonitasoft server. 

I tried to correlate this with the Suricata JSON logs, but I wasn't able to find any correlating logs.

This technique is called [Account Manipulation: SSH Authorized Keys](https://attack.mitre.org/techniques/T1098/004/) (T1098.004).

## Closing Thoughts

This Sherlock was a ton of fun allowing me to investigate Suricata logs, and do most of my investigating in Wireshark, which allowed for a great learning experience with Wireshark. 