
const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport");

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

let bluetoothPort = null;
let selectedPort = null;
let simulatedConnection = false;
let isConnecting = false;

const commands = {
  bedroomLight: {
    on: "1\n",
    off: "0\n"
  },
  livingRoomLight: {
    on: "2\n",
    off: "3\n"
  }
};

function isRealConnected() {
  return Boolean(bluetoothPort && bluetoothPort.isOpen);
}

function getStatus() {
  return {
    success: true,
    running: true,
    connected: isRealConnected() || simulatedConnection,
    simulated: simulatedConnection,
    selectedPort: selectedPort
  };
}

function closeBluetoothPort() {
  return new Promise(resolve => {
    if (!bluetoothPort) {
      selectedPort = null;
      resolve();
      return;
    }

    const port = bluetoothPort;

    if (!port.isOpen) {
      bluetoothPort = null;
      selectedPort = null;
      resolve();
      return;
    }

    port.close(error => {
      bluetoothPort = null;
      selectedPort = null;

      if (error) {
        console.error("Bluetooth close error:", error.message);
      }

      resolve();
    });
  });
}

// Server health
app.get("/health", (req, res) => {
  res.json(getStatus());
});

// List available COM ports
app.get("/api/ports", async (req, res) => {
  try {
    const ports = await SerialPort.list();

    res.json({
      success: true,
      ports: ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || "Unknown device",
        vendorId: port.vendorId || "",
        productId: port.productId || ""
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Connect simulated Bluetooth
app.post("/api/demo/connect", (req, res) => {
  if (isRealConnected()) {
    return res.status(400).json({
      success: false,
      message: "Disconnect physical Bluetooth before using Demo Mode."
    });
  }

  simulatedConnection = true;

  console.log("Demo Bluetooth connected.");

  res.json({
    success: true,
    connected: true,
    simulated: true,
    message: "Demo Bluetooth connected successfully."
  });
});

// Disconnect simulated Bluetooth
app.post("/api/demo/disconnect", (req, res) => {
  simulatedConnection = false;

  console.log("Demo Bluetooth disconnected.");

  res.json({
    success: true,
    connected: false,
    message: "Demo Bluetooth disconnected."
  });
});

// Connect physical HC-05
app.post("/api/connect", async (req, res) => {
  const { port } = req.body;

  if (!port || !/^COM\d+$/i.test(port)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid COM port."
    });
  }

  if (isConnecting) {
    return res.status(409).json({
      success: false,
      message: "A Bluetooth connection is already being attempted."
    });
  }

  if (isRealConnected()) {
    return res.status(400).json({
      success: false,
      message: "Bluetooth is already connected."
    });
  }

  if (simulatedConnection) {
    return res.status(400).json({
      success: false,
      message: "Disconnect Demo Bluetooth first."
    });
  }

  isConnecting = true;

  try {
    const newPort = new SerialPort({
      path: port,
      baudRate: 9600,
      autoOpen: false
    });

    await new Promise((resolve, reject) => {
      newPort.open(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });

    bluetoothPort = newPort;
    selectedPort = port;

    newPort.on("error", error => {
      console.error("Serial port error:", error.message);
    });

    newPort.on("close", () => {
      console.log("Bluetooth serial port closed.");

      if (bluetoothPort === newPort) {
        bluetoothPort = null;
        selectedPort = null;
      }
    });

    console.log(`HC-05 connected on ${port}`);

    res.json({
      success: true,
      connected: true,
      simulated: false,
      port,
      message: `Connected to ${port} successfully.`
    });
  } catch (error) {
    bluetoothPort = null;
    selectedPort = null;

    res.status(500).json({
      success: false,
      message: `Bluetooth connection failed: ${error.message}`
    });
  } finally {
    isConnecting = false;
  }
});

// Disconnect physical HC-05
app.post("/api/disconnect", async (req, res) => {
  try {
    simulatedConnection = false;
    await closeBluetoothPort();

    res.json({
      success: true,
      connected: false,
      message: "Bluetooth disconnected successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Send commands to Arduino or simulator
app.post("/api/send", async (req, res) => {
  const { device, state, speed } = req.body;

  if (!isRealConnected() && !simulatedConnection) {
    return res.status(400).json({
      success: false,
      message: "Bluetooth is not connected."
    });
  }

  let command = "";
  let message = "";

  // Bedroom and living room lights
  if (device === "bedroomLight" || device === "livingRoomLight") {
    if (typeof state !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Light state must be true or false."
      });
    }

    command = state
      ? commands[device].on
      : commands[device].off;

    message = `${device} turned ${state ? "ON" : "OFF"}`;
  }

  // Fan control
  else if (device === "fan") {
    if (typeof state !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Fan state must be true or false."
      });
    }

    const fanSpeed = state
      ? Number(speed ?? 60)
      : 0;

    if (
      !Number.isFinite(fanSpeed) ||
      fanSpeed < 0 ||
      fanSpeed > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Fan speed must be between 0 and 100."
      });
    }

    // Arduino firmware must use this same command format.
    command = state
      ? `FAN:${fanSpeed}\n`
      : "FAN:0\n";

    message = state
      ? `Fan turned ON at ${fanSpeed}% speed.`
      : "Fan turned OFF.";
  }

  else {
    return res.status(400).json({
      success: false,
      message: "Unknown device."
    });
  }

  // Simulation mode
  if (simulatedConnection) {
    console.log("[DEMO COMMAND]", command.trim());

    return res.json({
      success: true,
      simulated: true,
      command: command.trim(),
      message: `${message} (Demo Mode)`
    });
  }

  // Physical serial connection
  try {
    await new Promise((resolve, reject) => {
      bluetoothPort.write(command, error => {
        if (error) {
          reject(error);
          return;
        }

        bluetoothPort.drain(drainError => {
          if (drainError) {
            reject(drainError);
          } else {
            resolve();
          }
        });
      });
    });

    console.log("[ARDUINO COMMAND]", command.trim());

    res.json({
      success: true,
      simulated: false,
      command: command.trim(),
      message
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Command failed: ${error.message}`
    });
  }
});

// Start server
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`Bluetooth Bridge running at http://localhost:${PORT}`);
});

// Graceful shutdown
async function shutdown() {
  console.log("Closing Bluetooth Bridge...");

  await closeBluetoothPort();

  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
