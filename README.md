# Shelly Auto-Rebooter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Shelly Auto-Rebooter** is a set of open-source scripts designed for Shelly devices (such as Shelly Plug or Shelly 1) to monitor your modem and router connectivity. The scripts periodically ping external endpoints and send notifications via Telegram if connectivity degrades. If a device fails to respond after a configurable number of attempts, the script will automatically trigger a reboot of that device.

> **Note:** Two separate Shelly devices are required—one for your modem and one for your router. Each device is controlled independently.

## Features

- **Automatic Connectivity Monitoring**: Periodically pings external HTTP endpoints to check internet connectivity.
- **Automated Reboot**: Triggers a device reboot after a configurable number of consecutive ping failures.
- **Telegram Notifications**: Sends real-time status updates for ping failures, reboot events, and critical changes. (Successful pings are not reported.)
- **Configurable Parameters**: Adjust ping intervals, failure thresholds, startup delays, jitter, and reboot cooldowns.
- **Wi-Fi Check**: The script waits for the device to obtain an IP address before starting its monitoring loop.

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

- A Shelly device (e.g., Shelly Plug, Shelly Plug S, Shelly 1, or Shelly 1PM).
- A Telegram Bot—obtain your bot token by chatting with [BotFather](https://t.me/botfather).
- A Telegram Chat ID. You can easily obtain your Chat ID by sending a message to [@username_to_id_bot](https://t.me/username_to_id_bot).
- A working Wi-Fi network for your Shelly devices.

## Installation

1. **Create and Configure a Telegram Bot**
   Use BotFather to create a bot and get your **Bot Token**. Then obtain your **Chat ID** (for example by messaging [@username_to_id_bot](https://t.me/username_to_id_bot)).

2. **Update the Scripts**
   In each script, replace the placeholders below with your actual credentials:
   - `YOUR_TELEGRAM_BOT_TOKEN`
   - `YOUR_TELEGRAM_CHAT_ID`
   Also adjust the `deviceName` and `location` values as desired.

3. **Upload to Your Shelly Device**
   Open your browser and go to `http://<SHELLY_IP>/script/0` on each Shelly device.
   - Paste the **Modem Watchdog Script** (`modem.js`) into the Shelly that controls your modem.
   - Paste the **Router Watchdog Script** (`router.js`) into the Shelly that controls your router.
   Save the scripts and reboot the devices if necessary.

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

## Troubleshooting

### Script not starting
- Ensure the Shelly device is connected to Wi-Fi and has an IP address.
- Check the Shelly script console for errors (`http://<SHELLY_IP>/script/0`).
- Verify the script is saved and enabled.

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
