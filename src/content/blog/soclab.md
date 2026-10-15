---
title: Building a Cloud-Based SIEM Home Lab with Azure and Microsoft Sentinel
description: A comprehensive writeup of my virtualized SIEM/SOC lab.
date: 2025-10-17
tags:
  - SIEM
  - Azure
  - Threat Hunting
  - Security Engineering
  - Sentinel
featured: false
draft: false
---
![Microsoft Azure](https://oxen.tech/wp-content/uploads/2020/09/microsoftazure-featured.png)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;![Microsoft Sentinel](https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQmy1XAX_N7bV8NfKvzKMOei1Mr6SFnsohTerTIIVymsn8fH-HPr-eZypPAzo8kzyVgv6Y&usqp=CAU)
## Background

While browsing LinkedIn one day, I saw a post referencing a SOC/SIEM home lab that he created and the SIEM had recorded hundreds of external connection attempts overnight. That example motivated me to build a similar environment in Azure to analyze real-world logs.

## Overview 

In this lab, I will be utilizing Azure to deploy and configure a public-facing target virtual machine, and forward host and platform logs to a Log Analytics workspace running Microsoft Sentinel.

## Lab Architecture and Resources

In [Azure](https://azure.microsoft.com/), I provisioned a resource group to store my lab resources (Windows 10 virtual machine, network security group, and a virtual network) for the lab environment.

![ResourceGroup](https://i.imgur.com/he8aqp5.png)

Within that resource group, I created a virtual network for our virtual machine.

![VirtualNetwork](https://i.imgur.com/mrn998P.png)

Now that the resource group and the virtual network has been created in Azure, I deployed a legacy Windows 10 Pro virtual machine as the target to maximize noise and replicate the behavior of a poorly maintained endpoint.

## Exposure and telemetry collection

![VM](https://i.imgur.com/EHE8f3N.png)

Going back to the resource group, the virtual machine and related resources have populated within our resource group.

Now, to open up our target virtual machine to the public internet, we will access the `<VIRTUALMACHINE-NAME>-nsg` to edit the firewall rules. 

I deleted the default open 3389 (Remote Desktop Protocol) port, and created the worst firewall rule known to man, opening traffic for every port on our virtual machine:

![AllowAnyCustomAnyInbound](https://i.imgur.com/BFnVuy8.png)

Now that our network secuity group firewall is allowing traffic on any port, we also need to add a similar rule in the Windows Defender Firewall.

Using Remote Desktop Protocol, I connected to my Windows 10 Virtual Machine through its public IP address assigned on the overview page.

In order to generate the most amount of logs for the purpose of this lab, we will disable our last line of defense, the Windows Defender Firewall.

To access the Windows Defender Firewall, in the start menu, type `wf.msc`. Then, disable on Domain Profile, Private Profile, and Public Profile.

![FW](https://i.imgur.com/TAv7glt.png)

To confirm our virtual machine is reachable to the public internet, I pinged the virtual machines public IP address to confirm it is reachable.

![PING](https://i.imgur.com/iPczcg5.png)

I also felt like adding an enticing honeypot file named `records.txt` filled with dummy data inside a super real finance folder.

![HONEYPOT](https://i.imgur.com/lK1BLvI.png)


## Generating and capturing telemetry

Time to start messing around with some logs, to generate some logs I opened up Remote Desktop Connection on my local computer, and failed the logon a few times with a user that doesnt exist in the environment.

Signing back in as our labuser account, and opening the Event Viewer, we can capture our failed logon attempts.

![EV](https://i.imgur.com/5dBhb2u.png)

## Sentinel Integration & Hunting

Logging has been confirmed, however for the purpose of setting up a SIEM, in Azure I created a Log Analytics workspace, and then added Microsoft Sentinel to that Log Analytics workspace.

After setting up logging and Sentinel Extensions to our Log Analytics workspace, we can begin querying for logs using KQL.

Running a query for Security Alerts, no logs were generated. 🥲 So, to let the logs generate for a bit, I took a break and let the virtual machine open.

## Observations

After about an hour, by querying for successful logons, unsucessful logons, process creation, and service installations I began to notice some password spraying targeting user & administrator accounts from an IP of `102.88.21.216` in Nigeria.

![PWDSPRAY](https://i.imgur.com/18jGssK.png)

To further identify where the malicious traffic is coming from, I added a watchlist in Azure containing a .csv file with data on IP address and specific location information such as latitude/longitude, and city/country name.

Using a KQL query with our watchlist, searching for the attackers IP address and failed logon events, we can identify the latitude/longtitude and city name the malicious traffing is sourcing from.

![MALICOUSTRAFFIC1](https://i.imgur.com/PsstGGq.png)

Out of curiousity, I cross-referenced the IP and coordinates to Google Maps to better visualize the origin of the traffic: 

![GOOGLEMAPS](https://i.imgur.com/KRQBqhF.jpeg)

I did some research into creating an attack map in Azure, and was able to get that successfully running:

![ATTACKMAP1](https://i.imgur.com/xZCZO6c.png)

Since the lab environment has only been deployed for ~2 hours, and malicious activity is currently only coming from a single location, I will leave the virtual machine up for an additional 24 hours and observe attacker behaviours and further validate analytic rules and visualizations.

![UPDATE](https://i.imgur.com/wVODBTz.png)

Within approximately 12 hours, the virtual machine has recorded over 90,000 failed authentication attempts, indicating a large scale brute force or credential stuffing attack targeting the system. 

1/3 of the traffic coming from Maam, Netherlands.

## Learning Points

This lab provided valuable insight into real world attack logs, SIEM configuration, and threat-hunting methodologies within a controller Azure environment. Some key takeaways: 

1. Exposure driving visibility
- By intentionally exposing a poorly secured VM to the public internet with nearly no defenses other than a username and password, it became very clear very quickly how quickly automated scanners and brute forcers identify and target open systems. The speed and scale of the activity was very shocking with over 90,000 failed logon attempts in under 12 hours, 1,000 in the first hour. 
2. The importance of context
- Integrating external IP watchlists and geolocation data took these raw logs into key intelligence mapping attacker IPs to physical regions across the world really helped visualize the global distribution of attacks.
3. Log Centralization
- It was very nice having one centralized SIEM across the board, having all my logs flow into Microsoft Sentinel shows the importance of SIEMs and log centralization instead of combing across different tools to obtain key information.
4. KQL
- Using Kusto Query Language (KQL), allowed me to query important information, quickly. Using specific queries targeting specific event IDs, and user accounts, alongside IP geolocation data streamlined the process of identifying these brute force attacks.

## Next Steps

1. Deploy additional virtual machines under a domain to simulate a small enterprise network and expand log sources to include a variety of systems including Linux systems, database systems, and Azure activity logs. 
2. Integrating threat intelligence feeds into Microsoft Sentinel to gain a deeper understanding of detections.
3. Start writing custom detection rules and playbooks for automated response.