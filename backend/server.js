
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Current connection configuration
let connection = {
  mode: "demo",
  connected: true,
  controller: "Demo Controller",
  esp32Url: "",
  message: "Running in demo mode"
};

// Sensor readings
let sensorData = {
  temperature: 28,
  smoke: 120,
  motion: false,
  light: 650
};

// Device states
let devices = {
  bedroomLight: false,
  livingRoomLight: false,
  fan: false
};

// Server status
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Home Automation API is running",
    version: "2.0.0"
  });
});

// Connection status
app.get("/api/connection", (req, res) => {
  res.json({
    success: true,
    data: connection
  });
});

// Configure connection mode
app.post("/api/connection/config", (req, res) => {
  const { mode, esp32Url } = req.body;

  const supportedModes = ["demo", "hc05", "esp32"];

  if (!supportedModes.includes(mode)) {
    return res.status(400).json({
      success: false,
      message: "Choose demo, hc05, or esp32"
    });
  }

  if (mode === "esp32" && !esp32Url) {
    return res.status(400).json({
      success: false,
      message: "ESP32 server address is required"
    });
  }

  connection = {
    mode,
    connected: mode === "demo",
    controller:
      mode === "demo"
        ? "Demo Controller"
        : mode === "hc05"
          ? "Arduino Uno + HC-05"
          : "ESP32 Wi-Fi",
    esp32Url: mode === "esp32" ? esp32Url : "",
    message:
      mode === "demo"
        ? "Demo mode is active"
        : mode === "hc05"
          ? "HC-05 selected. Local Bluetooth bridge is not installed yet."
          : "ESP32 selected. Hardware communication is not configured yet."
  };

  res.json({
    success: true,
    message: "Connection configuration saved",
    data: connection
  });
});

// Sensor readings
app.get("/api/sensors", (req, res) => {
  res.json({
    success: true,
    data: sensorData
  });
});

// Device states
app.get("/api/devices", (req, res) => {
  res.json({
    success: true,
    data: devices
  });
});

// Device control
app.post("/api/devices/:device", (req, res) => {
  const device = req.params.device;
  const { state } = req.body;

  if (!Object.prototype.hasOwnProperty.call(devices, device)) {
    return res.status(404).json({
      success: false,
      message: "Device not found"
    });
  }

  if (typeof state !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "State must be true or false"
    });
  }

  if (connection.mode !== "demo") {
    return res.status(503).json({
      success: false,
      message: "Hardware adapter is not installed yet. Switch to Demo Mode."
    });
  }

  devices[device] = state;

  res.json({
    success: true,
    message: "Demo device updated",
    data: devices
  });
});

// Receive sensor readings from future hardware integrations
app.post("/api/hardware/sensors", (req, res) => {
  const suppliedKey = req.headers["x-device-key"];

  if (!process.env.DEVICE_API_KEY ||
      suppliedKey !== process.env.DEVICE_API_KEY) {
    return res.status(401).json({
      success: false,
      message: "Invalid device API key"
    });
  }

  const { temperature, smoke, motion, light } = req.body;

  if (
    typeof temperature !== "number" ||
    typeof smoke !== "number" ||
    typeof motion !== "boolean" ||
    typeof light !== "number"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid or incomplete sensor readings"
    });
  }

  sensorData = {
    temperature,
    smoke,
    motion,
    light
  };

  res.json({
    success: true,
    message: "Hardware sensor readings received",
    data: sensorData
  });
});

// Start API server
app.listen(PORT, "0.0.0.0", () => {
  console.log("-----------------------------------");
  console.log(" Smart Home Automation API");
  console.log(` Running at http://localhost:${PORT}`);
  console.log(" Connection modes: Demo / HC-05 / ESP32");
  console.log("-----------------------------------");
});
