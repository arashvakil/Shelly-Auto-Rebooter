let CONFIG = {
  endpoints: [
    "https://global.gcping.com/ping",
    "https://us-central1-5tkroniexa-uc.a.run.app/ping"
  ],
  numberOfFails: 3,
  httpTimeout: 10,
  toggleTime: 30,
  pingTime: 60,                    // Production ping interval (60 seconds)
  startupDelay: 600,               // 10-minute delay to wait for modem
  jitterRange: 5,
  rebootCooldown: 30 * 60 * 1000,  // 30-minute cooldown between reboots
  telegramBotToken: "YOUR_TELEGRAM_BOT_TOKEN",
  telegramChatId: "YOUR_TELEGRAM_CHAT_ID"
};

// Define device name and location for the router
let deviceName = "Router";         // Change to your actual router name
let location = "Home";             // Change to your desired location

let endpointIdx = 0;
let failCounter = 0;
let pingTimer = null;
let lastRebootTime = 0;
let pingLoopActive = false;

let emoji = {
  ping: "%F0%9F%93%A1",     // 📡
  ok: "%E2%9C%85",         // ✅
  fail: "%E2%9D%8C",       // ❌
  reboot: "%F0%9F%94%A5",   // 🔥
  cooldown: "%E2%8F%B3"    // ⏳
};

function pad2(n) {
  return (n < 10) ? "0" + n : n;
}

function getReadableTimestamp() {
  let now = new Date();
  return now.getFullYear() + "-" +
         pad2(now.getMonth() + 1) + "-" +
         pad2(now.getDate()) + " " +
         pad2(now.getHours()) + ":" +
         pad2(now.getMinutes()) + ":" +
         pad2(now.getSeconds());
}

function sendTelegramMessage(encodedText) {
  let url = "https://api.telegram.org/bot" +
            CONFIG.telegramBotToken +
            "/sendMessage?chat_id=" + CONFIG.telegramChatId +
            "&text=" + encodedText;
  Shelly.call("http.get", { url: url }, function(response, error_code, error_msg) {
    print("Telegram Sent:", encodedText);
    if (error_code !== 0) {
      print("Telegram Error:", error_code, error_msg);
    }
  });
}

function jitteredPingLoop() {
  if (!pingLoopActive) {
    print("Warning: Ping loop was inactive. Restarting...");
    pingLoopActive = true;
  }

  let jitter = Math.floor(Math.random() * (2 * CONFIG.jitterRange + 1)) - CONFIG.jitterRange;
  let delay = (CONFIG.pingTime + jitter) * 1000;
  print("Starting ping loop with delay: " + delay + "ms");
  if (pingTimer !== null) {
    Timer.clear(pingTimer);
  }
  pingTimer = Timer.set(delay, false, pingEndpoints);
  print("Timer ID: " + pingTimer);
}

function pingEndpoints() {
  print("Ping function triggered at " + getReadableTimestamp());
  let target = CONFIG.endpoints[endpointIdx];
  let timestamp = getReadableTimestamp();
  
  // Successful ping notifications are commented out for production
  // sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ping + "+Pinging+" + target + "+at+" + timestamp);

  Shelly.call("http.get", { url: target, timeout: CONFIG.httpTimeout }, function(response, error_code, error_message) {
    print("HTTP Response Code: " + (response ? response.code : "none") + ", Error code: " + error_code);
    if (error_code !== 0 || !response || response.code !== 200) {
      sendTelegramMessage(deviceName + " (" + location + "): " + emoji.fail + "+Ping+failed+to+" + target + "+at+" + getReadableTimestamp());
      failCounter++;
      endpointIdx = (endpointIdx + 1) % CONFIG.endpoints.length;
      print("Failure count: " + failCounter + ", switching to endpoint: " + CONFIG.endpoints[endpointIdx]);
    } else {
      // Uncomment the line below to report successful pings
      // sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ok + "+Ping+succeeded+to+" + target + "+at+" + getReadableTimestamp());
      failCounter = 0;
    }
    
    if (failCounter >= CONFIG.numberOfFails) {
      let now = Date.now();
      if ((now - lastRebootTime) > CONFIG.rebootCooldown) {
        sendTelegramMessage(deviceName + " (" + location + "): " + emoji.reboot + "+Too+many+failures.+Rebooting+router+at+" + getReadableTimestamp());
        lastRebootTime = now;
        pingLoopActive = false;
        if (pingTimer !== null) {
          Timer.clear(pingTimer);
          pingTimer = null;
        }
        Shelly.call("Switch.Set", { id: 0, on: false, toggle_after: CONFIG.toggleTime }, function () {});
        return;
      } else {
        sendTelegramMessage(deviceName + " (" + location + "): " + emoji.cooldown + "+Failure+threshold+reached,+but+reboot+skipped+(cooldown).");
        failCounter = 0;
      }
    }
    jitteredPingLoop();
  });
}

function startAfterDelay() {
  let timestamp = getReadableTimestamp();
  sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ok + "+Router+Ping+Watchdog+started+at+" + timestamp);
  pingLoopActive = true;
  jitteredPingLoop();
}

function checkNetworkReadyAndStart() {
  let status = Shelly.getComponentStatus("wifi");
  print("Wi-Fi status:", JSON.stringify(status));
  if (!status || !status.sta_ip || status.sta_ip === "") {
    print("Router: Still waiting for Wi-Fi...");
    Timer.set(2000, false, checkNetworkReadyAndStart);
    return;
  }
  let timestamp = getReadableTimestamp();
  print("Router: Wi-Fi is ready with IP " + status.sta_ip);
  sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ok + "+Wi-Fi+ready+at+" + timestamp);
  Timer.set(CONFIG.startupDelay * 1000, false, startAfterDelay);
}

Timer.set(3000, false, checkNetworkReadyAndStart);

Shelly.addStatusHandler(function (status) {
  if (status.name !== "switch" || status.id !== 0) return;
  if (typeof status.delta.source === "undefined" || status.delta.source !== "timer") return;
  if (status.delta.output !== true) return;
  let timestamp = getReadableTimestamp();
  sendTelegramMessage(deviceName + " (" + location + "): " + emoji.ok + "+Router+plug+powered+on.+Waiting+" + CONFIG.startupDelay + "+seconds+to+resume+pings.+Time:+" + timestamp);
  if (pingTimer !== null) {
    Timer.clear(pingTimer);
    pingTimer = null;
  }
  pingLoopActive = false;
  Timer.set(CONFIG.startupDelay * 1000, false, startAfterDelay);
});
