# Shelly Auto-Rebooter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Shelly Gen2+](https://img.shields.io/badge/Shelly-Gen2%2B-blue)](https://shelly.com)

**Shelly Auto-Rebooter** is a set of open-source scripts designed for Shelly devices (such as Shelly Plug or Shelly 1) to monitor your modem and router connectivity. The scripts periodically ping external endpoints and send notifications via Telegram if connectivity degrades. If a device fails to respond after a configurable number of attempts, the script will automatically trigger a reboot of that device.

> **Note:** Two separate Shelly devices are required—one for your modem and one for your router. Each device is controlled independently. See [Single Device Mode](#single-device-mode) if you have a modem/router combo.

## Quick Start

1. **Get a Shelly Plug** (or similar Gen2+ device with scripting support)
2. **Create a Telegram bot** via [@BotFather](https://t.me/botfather) and get your Chat ID from [@username_to_id_bot](https://t.me/username_to_id_bot)
3. **Copy `modem.js`** and replace `YOUR_TELEGRAM_BOT_TOKEN` and `YOUR_TELEGRAM_CHAT_ID`
4. **Paste into your Shelly** at `http://<SHELLY_IP>` → Scripts → Add Script → Save & Run
5. **Done!** You'll receive a Telegram message when the watchdog starts

For router monitoring, repeat with `router.js` on a second Shelly device.

## Features

- **Automatic Connectivity Monitoring**: Periodically pings external HTTP endpoints to check internet connectivity.
- **Automated Reboot**: Triggers a device reboot after a configurable number of consecutive ping failures.
- **Telegram Notifications**: Sends real-time status updates for ping failures, reboot events, and critical changes. (Successful pings are not reported by default.)
- **Configurable Parameters**: Adjust ping intervals, failure thresholds, startup delays, jitter, and reboot cooldowns.
- **Wi-Fi Check**: The script waits for the device to obtain an IP address before starting its monitoring loop.

## Compatibility

### Firmware Requirements

This script requires **Shelly Gen2 or newer** devices with scripting support. Gen1 devices do not support scripts.

| Device | Supported | Notes |
|--------|-----------|-------|
| Shelly Plug (Gen2) | ✅ | Recommended for modem/router |
| Shelly Plug S | ✅ | With energy monitoring |
| Shelly Plus 1 | ✅ | Relay-based control |
| Shelly Plus 1PM | ✅ | With power monitoring |
| Shelly Plus 2PM | ✅ | Dual relay |
| Shelly Pro series | ✅ | DIN rail mounting |
| Shelly 1 (Gen1) | ❌ | No scripting support |
| Shelly Plug (Gen1) | ❌ | No scripting support |

**Minimum firmware**: Any firmware supporting Shelly Scripts (mjs). Update to the latest stable firmware for best compatibility.

## Safety Warning

⚠️ **Before using this script, consider what you're plugging into the Shelly device.**

**Safe to auto-reboot:**
- Modems
- Routers
- Access points
- Network switches

**NOT safe to auto-reboot (may cause data loss or corruption):**
- NAS devices
- Servers with spinning hard drives
- Computers without proper shutdown
- Devices mid-firmware-update
- Security systems
- Medical equipment

**Best practices:**
- Use a UPS for sensitive equipment
- Set conservative failure thresholds (`numberOfFails: 5` or higher)
- Use longer cooldowns (`rebootCooldown: 3600000` = 1 hour) for critical infrastructure
- Test with non-critical devices first

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONITORING LOOP                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Ping Endpoint   │
                    └───────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
      ┌──────────────┐                ┌──────────────┐
      │   Success    │                │   Failure    │
      └──────────────┘                └──────────────┘
              │                               │
              ▼                               ▼
      ┌──────────────┐                ┌──────────────┐
      │ Reset fail   │                │ Increment    │
      │ counter to 0 │                │ fail counter │
      └──────────────┘                └──────────────┘
              │                               │
              │                               ▼
              │                    ┌─────────────────────┐
              │                    │ Failures >= 3?      │
              │                    └─────────────────────┘
              │                        │           │
              │                       Yes          No
              │                        │           │
              │                        ▼           │
              │              ┌─────────────────┐   │
              │              │ Cooldown OK?    │   │
              │              └─────────────────┘   │
              │                  │         │      │
              │                 Yes        No     │
              │                  │         │      │
              │                  ▼         ▼      │
              │           ┌──────────┐  ┌─────┐   │
              │           │ REBOOT   │  │Skip │   │
              │           │ Device   │  │     │   │
              │           └──────────┘  └─────┘   │
              │                  │         │      │
              │                  ▼         │      │
              │           ┌──────────┐     │      │
              │           │ Wait for │     │      │
              │           │ startup  │     │      │
              │           │ delay    │     │      │
              │           └──────────┘     │      │
              │                  │         │      │
              └──────────────────┴─────────┴──────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Wait (ping        │
                    │ interval ± jitter)│
                    └───────────────────┘
                              │
                              ▼
                         (Loop back)
```

### Why Two Devices?

The modem and router need separate Shelly devices because:

1. **Dependency Chain**: The router depends on the modem. If the modem loses internet, rebooting the router won't help.
2. **Independent Monitoring**: Each device monitors and reboots its own hardware independently.
3. **Startup Timing**: The modem script includes a 10-minute startup delay to allow the modem to fully initialize before monitoring begins. The router script has a similar delay to wait for the modem.

## Single Device Mode

If you have a **modem/router combo unit** (gateway), you only need one Shelly device. Use `modem.js` with these recommended settings:

```javascript
let CONFIG = {
  // ... other settings ...
  startupDelay: 300,           // 5 minutes is usually enough for combo units
  toggleTime: 45,              // Slightly longer off-time for full reset
};

let deviceName = "Gateway";    // Or "Modem-Router"
```

**Tip:** Combo units often take longer to fully initialize than standalone modems. If you experience issues, increase `startupDelay` to 600 (10 minutes).

## Architecture

```
                                    INTERNET
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                           YOUR HOME                              │
│                                                                  │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│   │   MODEM     │      │   ROUTER    │      │   DEVICES   │     │
│   │             │──────│             │──────│  (phones,   │     │
│   │             │      │             │      │   laptops)  │     │
│   └─────────────┘      └─────────────┘      └─────────────┘     │
│          │                    │                                  │
│          │ power              │ power                            │
│          ▼                    ▼                                  │
│   ┌─────────────┐      ┌─────────────┐                          │
│   │ Shelly Plug │      │ Shelly Plug │                          │
│   │ (modem.js)  │      │ (router.js) │                          │
│   └─────────────┘      └─────────────┘                          │
│          │                    │                                  │
│          │    Wi-Fi           │    Wi-Fi                         │
│          └────────────────────┴──────────────────────────────►  │
│                         Ping external endpoints                  │
│                         Send Telegram alerts                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- A Shelly device (Gen2+) with scripting support (see [Compatibility](#compatibility))
- A Telegram Bot—obtain your bot token by chatting with [BotFather](https://t.me/botfather)
- A Telegram Chat ID. You can easily obtain your Chat ID by sending a message to [@username_to_id_bot](https://t.me/username_to_id_bot)
- A working Wi-Fi network for your Shelly devices

## Installation

1. **Create and Configure a Telegram Bot**
   Use BotFather to create a bot and get your **Bot Token**. Then obtain your **Chat ID** (for example by messaging [@username_to_id_bot](https://t.me/username_to_id_bot)).

2. **Update the Scripts**
   In each script, replace the placeholders below with your actual credentials:
   - `YOUR_TELEGRAM_BOT_TOKEN`
   - `YOUR_TELEGRAM_CHAT_ID`
   Also adjust the `deviceName` and `location` values as desired.

3. **Upload to Your Shelly Device**
   Open your browser and go to `http://<SHELLY_IP>` on each Shelly device.
   - Navigate to **Scripts** → **Add Script**
   - Paste the **Modem Script** (`modem.js`) into the Shelly that controls your modem
   - Paste the **Router Script** (`router.js`) into the Shelly that controls your router
   - Click **Save** and then **Start** to run the script
   - Enable "Run on startup" to persist across reboots

4. **Monitor the Logs**
   Check your Telegram channel for notifications and use the Shelly script console for debug logs.

## Configuration Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `endpoints` | gcping.com, Google Cloud | Array of URLs to ping. If one fails, the script tries the next. |
| `numberOfFails` | `3` | Number of consecutive failures before triggering a reboot. |
| `httpTimeout` | `10` | Timeout in seconds for each HTTP ping request. |
| `toggleTime` | `30` | Seconds the device stays off during a reboot cycle. |
| `pingTime` | `60` | Interval in seconds between ping attempts. |
| `startupDelay` | `600` | Seconds to wait after power-on before starting monitoring (10 minutes). |
| `jitterRange` | `5` | Random variance (±seconds) added to ping interval to avoid synchronized requests. |
| `rebootCooldown` | `1800000` | Minimum milliseconds (30 minutes) between reboots to prevent reboot loops. |
| `telegramBotToken` | — | Your Telegram bot token from BotFather. |
| `telegramChatId` | — | Your Telegram chat ID for receiving notifications. |
| `deviceName` | `"Modem"` / `"Router"` | Name displayed in Telegram notifications. |
| `location` | — | Location label displayed in Telegram notifications. |

## Choosing Ping Endpoints

The default endpoints are Google Cloud-based ping services. You can customize these based on your needs:

### Recommended Endpoints

```javascript
endpoints: [
  "https://global.gcping.com/ping",           // Google Cloud global
  "https://us-central1-5tkroniexa-uc.a.run.app/ping",  // Google Cloud US
  "https://cloudflare.com/cdn-cgi/trace",     // Cloudflare
  "https://www.google.com/generate_204",      // Google connectivity check
  "https://www.apple.com/library/test/success.html",   // Apple
]
```

### Choosing Good Endpoints

**Do:**
- Use multiple endpoints (2-4) for redundancy
- Choose geographically distributed services
- Use endpoints with high uptime (Google, Cloudflare, Amazon)
- Use lightweight endpoints that return quickly

**Don't:**
- Use a single endpoint (if it goes down, you'll get false reboots)
- Use your own servers (defeats the purpose)
- Use endpoints that rate-limit or block frequent requests
- Use endpoints that return large payloads

### Regional Alternatives

| Region | Endpoint |
|--------|----------|
| Europe | `https://europe-west1-5tkroniexa-ew.a.run.app/ping` |
| Asia | `https://asia-east1-5tkroniexa-an.a.run.app/ping` |
| AWS US | `https://aws.amazon.com/` |

## Telegram Notification Examples

Here's what you can expect to see in your Telegram chat:

| Event | Example Message |
|-------|-----------------|
| **Script Started** | ✅ Modem (Home): Wi-Fi ready at 2025-01-15 10:30:00 |
| **Watchdog Active** | ✅ Modem (Home): Modem Ping Watchdog started at 2025-01-15 10:40:00 |
| **Ping Failed** | ❌ Router (Home): Ping failed to https://global.gcping.com/ping at 2025-01-15 14:22:15 |
| **Reboot Triggered** | 🔥 Modem (Home): Too many failures. Rebooting modem at 2025-01-15 14:25:00 |
| **Cooldown Active** | ⏳ Router (Home): Failure threshold reached, but reboot skipped (cooldown). |
| **Device Back Online** | ✅ Modem (Home): Modem plug powered on. Waiting 600 seconds to resume pings. |

### Enabling Success Notifications

By default, successful pings are not reported to avoid notification spam. To enable them, uncomment these lines in the script:

```javascript
// In pingEndpoints() function, uncomment:
sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ok + "+Ping+succeeded+to+" + target + "+at+" + getReadableTimestamp());
```

## Alternative Notification Methods

The script uses Telegram by default, but you can adapt the `sendTelegramMessage()` function for other services:

### Discord Webhook
```javascript
function sendDiscordMessage(text) {
  let url = "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN";
  Shelly.call("http.post", {
    url: url,
    body: JSON.stringify({ content: text }),
    content_type: "application/json"
  }, function(response, error_code, error_msg) {
    print("Discord Sent:", text);
  });
}
```

### Pushover
```javascript
function sendPushoverMessage(text) {
  let url = "https://api.pushover.net/1/messages.json";
  Shelly.call("http.post", {
    url: url,
    body: "token=YOUR_APP_TOKEN&user=YOUR_USER_KEY&message=" + encodeURIComponent(text),
    content_type: "application/x-www-form-urlencoded"
  }, function(response, error_code, error_msg) {
    print("Pushover Sent:", text);
  });
}
```

### Slack Webhook
```javascript
function sendSlackMessage(text) {
  let url = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL";
  Shelly.call("http.post", {
    url: url,
    body: JSON.stringify({ text: text }),
    content_type: "application/json"
  }, function(response, error_code, error_msg) {
    print("Slack Sent:", text);
  });
}
```

## Troubleshooting

### Script not starting
- Ensure the Shelly device is connected to Wi-Fi and has an IP address.
- Check the Shelly script console for errors (`http://<SHELLY_IP>` → Scripts).
- Verify the script is saved and enabled ("Run on startup" checked).
- Confirm you have a Gen2+ device (Gen1 doesn't support scripts).

### No Telegram notifications
- Double-check your `telegramBotToken` and `telegramChatId` values.
- Ensure you've started a chat with your bot (send it any message first).
- Check if the bot token is valid by visiting `https://api.telegram.org/bot<YOUR_TOKEN>/getMe`.

### Too many reboots
- Increase `numberOfFails` to require more failures before rebooting.
- Increase `rebootCooldown` to add more time between allowed reboots.
- Check if your ping endpoints are reliable; consider adding more endpoints to the array.

### Device reboots but internet doesn't recover
- Increase `toggleTime` to keep the device off longer during reboot.
- Increase `startupDelay` to give the modem/router more time to initialize.
- Verify your ISP isn't experiencing an outage.

### Script stops working after a while
- Check the Shelly device's memory usage in the web UI.
- Ensure the script console shows no repeated errors.
- Restart the Shelly device to clear any stuck states.

## Known Limitations

1. **Wi-Fi Dependency**: The Shelly device must be connected to your Wi-Fi network to ping external endpoints. If the router itself fails and the Shelly loses Wi-Fi, it cannot trigger a reboot. Consider using a separate Wi-Fi network or Ethernet-connected device for critical monitoring.

2. **No Modem-First Logic**: The modem and router scripts operate independently. If your ISP is down, both devices may reboot unnecessarily. The cooldown feature mitigates this but doesn't prevent it entirely.

3. **Power Surge Risk**: Rapid on/off cycling could potentially stress some devices. The 30-second `toggleTime` and 30-minute `rebootCooldown` are designed to minimize this risk.

4. **No Health Metrics**: The script doesn't track historical uptime, reboot counts, or other metrics. Consider integrating with a time-series database if you need analytics.

5. **Single Chat ID**: Notifications go to one Telegram chat. For multiple recipients, create a Telegram group and use the group's chat ID.

6. **HTTP Only**: The script uses HTTP GET requests to ping endpoints. It cannot perform ICMP ping or check specific ports.

## Changelog

### v1.0.0 (2025-01)
- Initial release
- Modem and router watchdog scripts
- Telegram notifications
- Configurable ping intervals, failure thresholds, and cooldowns
- Jitter to prevent synchronized pings
- Startup delay for device initialization

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
