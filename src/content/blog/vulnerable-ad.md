---
title: Vulnerable Active Directory - Homelab
description: An in-depth writeup of setting up my homelab.
date: 2025-10-22
tags:
  - Penetration Testing
  - Blue Team
  - Active Directory
  - Security
  - Homelab
  - Proxmox
  - Windows
featured: false
draft: true
---

[Vulnerable AD](https://github.com/safebuffer/vulnerable-AD) is a PowerShell script that automatically builds a insecure Active Directory environment for Penetration Testing & Blue Team training. It simulates real-world misconfigurations like weak passwords, ACL abuse, Kerberoasting, and DCSync rights.

For the scope of this project, I intend on deploying Vulnerable AD in my homelab Domain Controller environment, and using a Kali Linux VM to practice offensive security techniques to exploit the vulnerabilities created by vulnad.

```powershell
IEX((new-object net.webclient).downloadstring("https://raw.githubusercontent.com/wazehell/vulnerable-AD/master/vulnad.ps1"));
Invoke-VulnAD -UsersLimit 100 -DomainName "[DEPRECATED].local"
```

![vulnAD](https://i.imgur.com/CNlS5eO.png)

```
[+] 100 new users created in the environment
[+] Office Admin IT Admins Executives Groups Created
[+] Senior Management Project Management Groups Created
[+] Marketing Sales Accoutning Groups Created
[+] BadACL Done
[+] Kerberoasting Done
[+] AS-RepRoasting Done
[+] Password In Object Description Done
[+] Default Password Done
[+] Password Spraying Done
[+] DCSync Done
[+] SMB Signing Disabled
```

Now that `vulnad.ps1` has been executed on the Domain Controller, our vulnerable Active Directory environment is now setup.

![AD](https://i.imgur.com/HLsHpj7.png)


 

