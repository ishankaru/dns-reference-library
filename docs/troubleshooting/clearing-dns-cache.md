# Clearing DNS Cache

## Why DNS Caches Exist and When to Clear Them

DNS resolvers at every layer — operating system, browser, and recursive resolver — cache responses to reduce latency and query volume. After a DNS change is made, cached records continue to be served until their TTL expires.

Clearing the local DNS cache forces the next query to go to the recursive resolver (and ultimately to the authoritative server) rather than serving a stale local entry. This is useful when:

- Testing a DNS change before the TTL has expired.
- Diagnosing whether a DNS issue is local (cache) or global (resolver/authoritative). See the [guide to DNS TTL](https://dnschkr.com/blog/what-is-dns-ttl) for how caching durations are determined.
- Recovering from a corrupted or stale cache entry.

Clearing a local cache only affects queries made from that machine. It does not affect ISP resolvers, public resolvers, or other machines. After flushing your local cache, you can use the [DNS propagation checker](https://dnschkr.com/propagation-checker) to see whether resolvers worldwide are also returning the updated record.

## Windows

### Command: ipconfig /flushdns

Flushes the Windows DNS Client service cache. This clears all cached DNS entries stored by the Windows DNS resolver.

```cmd
ipconfig /flushdns
```

Expected output:
```
Windows IP Configuration

Successfully flushed the DNS Resolver Cache.
```

This command must be run in an elevated Command Prompt (Run as Administrator) on some Windows versions, though it typically works without elevation.

### Additional Windows Commands

```cmd
# Display current cache contents before flushing
ipconfig /displaydns

# Register/refresh DNS records (pushes current hostname to DNS)
ipconfig /registerdns

# Restart the DNS Client service (alternative to flush)
net stop dnscache && net start dnscache
```

On Windows Server with the DNS Server role installed, flushing the server's cache is done through the DNS Manager console or:

```powershell
# PowerShell — clear DNS server cache (on DNS Server role installations)
Clear-DnsServerCache

# PowerShell — flush local resolver cache
Clear-DnsClientCache

# PowerShell — show current cache entries
Get-DnsClientCache
```

### Windows Versions

The `ipconfig /flushdns` command works on all currently supported Windows versions (Windows 10, 11, and Windows Server 2016–2025). The DNS Client service caches both positive and negative responses.

## macOS

### Modern macOS (10.10.4 Yosemite and later)

macOS uses `mDNSResponder` as its DNS resolver daemon. Flushing requires two steps:

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

Both commands are required. `dscacheutil -flushcache` clears the Directory Service cache. `killall -HUP mDNSResponder` sends a SIGHUP signal to mDNSResponder, causing it to flush its internal DNS cache.

Running only one command may not clear all cached entries depending on the macOS version.

### macOS Version History

Different macOS versions use different flush commands:

| macOS Version | Command |
|---|---|
| macOS 12 Monterey and later | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |
| macOS 10.14–11.x | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |
| macOS 10.10.4–10.13 | `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` |
| macOS 10.10.0–10.10.3 | `sudo discoveryutil mdnsflushcache` |
| macOS 10.7–10.9 | `sudo killall -HUP mDNSResponder` |

For macOS 12 and later, adding a log message makes it easier to confirm the flush completed:

```bash
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

There is no output on success; the absence of an error message indicates the command ran successfully.

### Verifying the Flush

```bash
# Before flush: query will return cached result
dig A example.com

# After flush: query will go to resolver fresh
dig A example.com

# The TTL value in the answer section will reset to the full original TTL
# after a fresh lookup, rather than showing a reduced cached TTL
```

## Linux

Linux DNS caching behavior varies by distribution and configuration. The cache may be managed by:

- `systemd-resolved` — used by Ubuntu 18.04+, Fedora, Arch Linux, Debian 11+
- `nscd` (Name Service Cache Daemon) — older distributions, still used in some enterprise configurations
- `dnsmasq` — common on embedded systems and some desktop distributions
- No local cache — some minimal configurations query the network resolver directly for every lookup

### systemd-resolved

```bash
# Flush the systemd-resolved cache
sudo systemd-resolve --flush-caches

# Verify it flushed (shows statistics)
sudo systemd-resolve --statistics

# Alternative command (equivalent)
sudo resolvectl flush-caches

# Check current cache statistics
resolvectl statistics
```

`resolvectl flush-caches` is the newer interface; `systemd-resolve --flush-caches` is the older form. Both work on modern systemd versions.

To check if `systemd-resolved` is running on your system:

```bash
systemctl is-active systemd-resolved
# Returns "active" or "inactive"
```

### nscd (Name Service Cache Daemon)

```bash
# Flush all nscd caches
sudo nscd -i hosts

# Or restart the service entirely
sudo systemctl restart nscd
# or on SysV init systems:
sudo service nscd restart
```

### dnsmasq

```bash
# Flush dnsmasq cache by sending SIGHUP
sudo killall -HUP dnsmasq

# Or restart the service
sudo systemctl restart dnsmasq
```

### No Local Cache (Direct Resolver)

If no local caching service is running, DNS queries go directly to the resolver specified in `/etc/resolv.conf`. Verify:

```bash
cat /etc/resolv.conf
# Look for nameserver lines
```

In this case, there is no local cache to flush. The cache is at the resolver (your ISP's server, or a public resolver like 8.8.8.8). You cannot flush these remotely.

## Browsers

Browsers maintain their own DNS cache independent of the operating system. Flushing the OS cache does not affect the browser's cache. Both must be cleared for testing.

### Google Chrome and Chromium-based Browsers

Navigate to the internal DNS management page:

```
chrome://net-internals/#dns
```

Click the "Clear host cache" button on this page.

Also clear the socket pool to ensure new connections are made:

```
chrome://net-internals/#sockets
```

Click "Flush socket pools."

For Chromium-based browsers (Edge, Brave, Opera), use:

```
edge://net-internals/#dns
brave://net-internals/#dns
opera://net-internals/#dns
```

### Mozilla Firefox

Firefox uses its own DNS cache with a configurable TTL. To flush it:

**Method 1: History clear**
1. Open History menu (Ctrl+Shift+H / Cmd+Shift+H).
2. Select "Clear Recent History."
3. Ensure "Cache" is checked.
4. Click "Clear Now."

**Method 2: about:config override (temporarily disables DNS caching)**
1. Navigate to `about:config`.
2. Search for `network.dnsCacheExpiration`.
3. Set value to `0` (disables caching; remember to restore it).
4. Set back to `60` (default) after testing.

**Method 3: Restart Firefox**
Restarting Firefox clears the in-memory DNS cache entirely.

The Firefox DNS cache TTL is controlled by `network.dnsCacheExpiration` (default: 60 seconds). Firefox respects the DNS TTL up to this maximum.

### Safari

Safari on macOS uses the OS-level DNS resolution (mDNSResponder). Flushing the macOS system cache as described above is sufficient. Safari does not maintain a separate DNS cache layer.

## Flushing at the Resolver Level

### Cloudflare 1.1.1.1

Cloudflare provides a web form to purge a specific domain from their resolver's cache:

```
https://1.1.1.1/purge-cache/
```

### Google 8.8.8.8

Google does not provide a public cache purge interface for their public DNS resolvers.

### Corporate/Enterprise Resolvers

If you are behind a corporate DNS resolver (common in office networks and VPNs), you may need to ask the network administrator to flush the resolver's cache, or connect outside the corporate network to bypass it entirely.

## Verification After Flushing

After flushing, confirm that the new DNS record is being returned:

```bash
# Should return the new value immediately after authoritative servers are updated
dig A example.com

# Compare against authoritative server directly to confirm what the correct answer is
dig A example.com @ns1.example.com

# Check TTL to confirm it's a fresh lookup (should show full TTL, not a reduced cached TTL)
dig A example.com +ttlunits
```

If the OS and browser caches are cleared but the wrong record is still returned, the recursive resolver still has the record cached. In this case, wait for the TTL to expire or use a different resolver temporarily for testing. The [DNS inspector](https://dnschkr.com/dns-inspector) queries authoritative servers directly, bypassing resolver caches entirely — useful for confirming the change is live at the source.

## References

- RFC 1034 — DNS TTL semantics: https://www.rfc-editor.org/rfc/rfc1034
- RFC 2308 — Negative Caching of DNS Queries: https://www.rfc-editor.org/rfc/rfc2308
- systemd-resolved man page: https://www.freedesktop.org/software/systemd/man/systemd-resolved.service.html
- Chrome net-internals documentation: https://chromium.googlesource.com/chromium/src/+/main/net/docs/net-internals.md
- Cloudflare DNS Cache Purge: https://1.1.1.1/purge-cache/
- Apple Technical Note — mDNSResponder: https://developer.apple.com/bonjour/
