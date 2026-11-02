
import { useState, useEffect, useRef } from "react";
import {
  Home, Lightbulb, Thermometer, Shield, Settings,
  Fan, Activity, Flame, Sun, Moon, Wifi, Power,
  Menu, X, Bluetooth, Save, Server, RefreshCw, Unplug
} from "lucide-react";

import {
  getSensorData,
  getDeviceData,
  updateDevice
} from "./services/sensorService";

import "./App.css";

const API = "http://localhost:5000/api";
const BRIDGE = "http://localhost:5001";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  const [sensorData, setSensorData] = useState({
    temperature: "--",
    smoke: "--",
    motion: false,
    light: "--"
  });

  const [devices, setDevices] = useState({
    bedroomLight: false,
    livingRoomLight: false,
    fan: false
  });

  const [fanSpeed, setFanSpeed] = useState(60);

  const [connection, setConnection] = useState({
    mode: "demo",
    connected: true,
    controller: "Demo Controller",
    esp32Url: "",
    message: "Running in demo mode"
  });

  const [selectedMode, setSelectedMode] = useState("demo");
  const [esp32Url, setEsp32Url] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const [bridgeRunning, setBridgeRunning] = useState(false);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [bluetoothSimulated, setBluetoothSimulated] = useState(false);
  const [selectedPort, setSelectedPort] = useState("");
  const [availablePorts, setAvailablePorts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [fanUpdating, setFanUpdating] = useState(false);

  const connectionModeRef = useRef("demo");

  const navigation = [
    { name: "Dashboard", icon: Home },
    { name: "Room Lights", icon: Lightbulb },
    { name: "Climate Control", icon: Thermometer },
    { name: "Security", icon: Shield },
    { name: "Settings", icon: Settings }
  ];

  // Load dashboard, backend connection and Bluetooth status
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [sensors, deviceData] = await Promise.all([
          getSensorData(),
          getDeviceData()
        ]);

        if (!mounted) return;

        if (sensors) {
          setSensorData(sensors);
        }

        if (deviceData && connectionModeRef.current !== "hc05") {
          setDevices(previous => ({
            ...previous,
            ...deviceData
          }));
        }
      } catch (error) {
        console.error("Dashboard update error:", error);
      }
    };

    const loadConnection = async () => {
      try {
        const response = await fetch(`${API}/connection`);
        const result = await response.json();

        if (mounted && result.success) {
          setConnection(result.data);
          setSelectedMode(result.data.mode);
          setEsp32Url(result.data.esp32Url || "");
          connectionModeRef.current = result.data.mode;
        }
      } catch (error) {
        console.error("Backend connection status error:", error);
      }
    };

    const loadBluetoothStatus = async () => {
      try {
        const response = await fetch(`${BRIDGE}/health`);
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error("Bridge unavailable");
        }

        if (mounted) {
          setBridgeRunning(true);
          setBluetoothConnected(Boolean(result.connected));
          setBluetoothSimulated(Boolean(result.simulated));
          setSelectedPort(
            result.simulated ? "" : result.selectedPort || ""
          );
        }
      } catch {
        if (mounted) {
          setBridgeRunning(false);
          setBluetoothConnected(false);
          setBluetoothSimulated(false);
          setSelectedPort("");
        }
      }
    };

    loadData();
    loadConnection();
    loadBluetoothStatus();

    const interval = setInterval(() => {
      loadData();
      loadBluetoothStatus();
    }, 2000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Scan Windows COM ports
  const scanBluetoothPorts = async () => {
    setScanning(true);
    setNotice("");

    try {
      const response = await fetch(`${BRIDGE}/api/ports`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to scan COM ports.");
      }

      setAvailablePorts(result.ports || []);

      if (result.ports?.length > 0) {
        setSelectedPort(current => {
          const stillAvailable = result.ports.some(
            port => port.path === current
          );

          return stillAvailable ? current : result.ports[0].path;
        });

        setNotice(
          `Found ${result.ports.length} serial port(s). Select your HC-05 port.`
        );
      } else {
        setSelectedPort("");
        setNotice("No COM ports found. Pair your HC-05 with Windows first.");
      }
    } catch {
      setNotice(
        "Bluetooth Bridge is unavailable. Start the bridge on this laptop."
      );
      setBridgeRunning(false);
    } finally {
      setScanning(false);
    }
  };

  // Connect physical HC-05
  const connectBluetooth = async () => {
    if (!selectedPort) {
      setNotice("Please scan and select an HC-05 COM port first.");
      return;
    }

    setConnecting(true);
    setNotice("");

    try {
      const response = await fetch(`${BRIDGE}/api/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          port: selectedPort
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Bluetooth connection failed.");
      }

      setBluetoothConnected(true);
      setBluetoothSimulated(false);
      setSelectedPort(result.port || selectedPort);
      setNotice(result.message);
    } catch (error) {
      setBluetoothConnected(false);
      setNotice(error.message || "Could not connect to HC-05.");
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Bluetooth
  const disconnectBluetooth = async () => {
    setNotice("");

    try {
      const endpoint = bluetoothSimulated
        ? "/api/demo/disconnect"
        : "/api/disconnect";

      const response = await fetch(`${BRIDGE}${endpoint}`, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Disconnect failed.");
      }

      setBluetoothConnected(false);
      setBluetoothSimulated(false);
      setSelectedPort("");
      setNotice(result.message);
    } catch (error) {
      setNotice(error.message || "Could not disconnect Bluetooth.");
    }
  };

  // Connect simulated Bluetooth
  const connectDemoBluetooth = async () => {
    setNotice("");

    try {
      const response = await fetch(`${BRIDGE}/api/demo/connect`, {
        method: "POST"
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Demo connection failed.");
      }

      setBluetoothConnected(true);
      setBluetoothSimulated(true);
      setSelectedPort("");
      setNotice(result.message);
    } catch (error) {
      setNotice(error.message || "Could not start Bluetooth Demo.");
    }
  };

  // Save selected connection mode
  const saveConnection = async () => {
    if (selectedMode === "esp32" && !esp32Url.trim()) {
      setNotice("Please enter your ESP32 IP address.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await fetch(`${API}/connection/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: selectedMode,
          esp32Url: esp32Url.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Configuration failed.");
      }

      setConnection(result.data);
      connectionModeRef.current = selectedMode;
      setNotice(result.message || "Connection settings saved.");
    } catch (error) {
      setNotice(error.message || "Could not save connection settings.");
    } finally {
      setSaving(false);
    }
  };

  // Send fan command through Bluetooth bridge
  const sendBluetoothFanCommand = async (state, speed) => {
    const response = await fetch(`${BRIDGE}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        device: "fan",
        state,
        speed
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message || "Fan command is not supported by the bridge yet."
      );
    }

    return result;
  };

  // Fan ON/OFF
  const setFanPower = async (newState) => {
    if (fanUpdating) return;

    if (connection.mode === "hc05" && !bluetoothConnected) {
      setNotice("Connect Bluetooth first.");
      return;
    }

    setFanUpdating(true);
    setNotice("");

    try {
      if (connection.mode === "hc05") {
        await sendBluetoothFanCommand(
          newState,
          newState ? fanSpeed : 0
        );
      } else {
        await updateDevice("fan", newState);
      }

      setDevices(previous => ({
        ...previous,
        fan: newState
      }));

      setNotice(newState ? "Fan turned ON." : "Fan turned OFF.");
    } catch (error) {
      setNotice(error.message || "Fan control failed.");
    } finally {
      setFanUpdating(false);
    }
  };

  // Fan speed control
  const changeFanSpeed = async (newSpeed) => {
    const speed = Number(newSpeed);

    setFanSpeed(speed);

    if (!devices.fan) {
      setNotice(`Fan speed set to ${speed}%. Turn the fan ON to run it.`);
      return;
    }

    if (connection.mode === "hc05") {
      if (!bluetoothConnected) {
        setNotice("Connect Bluetooth first.");
        return;
      }

      try {
        await sendBluetoothFanCommand(true, speed);
        setNotice(`Fan speed set to ${speed}%.`);
      } catch (error) {
        setNotice(error.message || "Could not change fan speed.");
      }
    } else {
      setNotice(`Fan speed set to ${speed}% in the interface.`);
    }
  };

  // Light and other device controls
  const toggleDevice = async (device) => {
    if (device === "fan") {
      await setFanPower(!devices.fan);
      return;
    }

    const newState = !devices[device];

    if (connection.mode === "hc05") {
      if (!bluetoothConnected) {
        setNotice("Connect Bluetooth first.");
        return;
      }

      try {
        const response = await fetch(`${BRIDGE}/api/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            device,
            state: newState
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Bluetooth command failed.");
        }

        setDevices(previous => ({
          ...previous,
          [device]: newState
        }));

        setNotice(result.message);
      } catch (error) {
        setNotice(error.message || "Bluetooth command failed.");
      }

      return;
    }

    setDevices(previous => ({
      ...previous,
      [device]: newState
    }));

    try {
      await updateDevice(device, newState);
      setNotice("Device updated successfully.");
    } catch (error) {
      setDevices(previous => ({
        ...previous,
        [device]: !newState
      }));

      setNotice(error.message || "Device control failed.");
    }
  };

  const deviceList = [
    {
      key: "bedroomLight",
      name: "Bedroom Light",
      room: "Bedroom",
      icon: Lightbulb
    },
    {
      key: "livingRoomLight",
      name: "Living Room Light",
      room: "Living Room",
      icon: Lightbulb
    },
    {
      key: "fan",
      name: "Cooling Fan",
      room: "Living Room",
      icon: Fan
    }
  ];

  const sensorList = [
    {
      name: "Temperature",
      value: `${sensorData.temperature} °C`,
      icon: Thermometer,
      description: "LM35 sensor"
    },
    {
      name: "Smoke Level",
      value: sensorData.smoke,
      icon: Flame,
      description: "MQ-2 sensor"
    },
    {
      name: "Motion Detection",
      value: sensorData.motion ? "Detected" : "No Motion",
      icon: Activity,
      description: "PIR sensor"
    },
    {
      name: "Light Intensity",
      value: sensorData.light,
      icon: Sun,
      description: "LDR sensor"
    }
  ];

  // Sensor cards
  const renderSensors = (list) => (
    <div className="sensor-grid">
      {list.map(sensor => {
        const Icon = sensor.icon;

        return (
          <div className="sensor-card" key={sensor.name}>
            <div className="card-icon">
              <Icon />
            </div>

            <h3>{sensor.name}</h3>
            <h2>{sensor.value}</h2>
            <p>{sensor.description}</p>
          </div>
        );
      })}
    </div>
  );

  // Device cards
  const renderDevices = (list) => (
    <div className="device-grid">
      {list.map(device => {
        const Icon = device.icon;
        const isOn = devices[device.key];

        return (
          <div className="device-card" key={device.key}>
            <div className="device-top">
              <div className="card-icon">
                <Icon />
              </div>

              <span className={isOn ? "active-label" : "inactive-label"}>
                {isOn ? "ON" : "OFF"}
              </span>
            </div>

            <h3>{device.name}</h3>
            <p>{device.room}</p>

            <button
              className={
                isOn
                  ? "device-button active-button"
                  : "device-button"
              }
              onClick={() => toggleDevice(device.key)}
              disabled={device.key === "fan" && fanUpdating}
            >
              <Power size={17} />
              {device.key === "fan" && fanUpdating
                ? "Updating..."
                : isOn
                  ? "Turn OFF"
                  : "Turn ON"}
            </button>
          </div>
        );
      })}
    </div>
  );

  // Fan controls
  const renderFanControl = () => (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>Cooling Fan Control</h2>
        <span>{devices.fan ? "Fan Running" : "Fan Stopped"}</span>
      </div>

      <div className="overview-card" style={{ display: "block" }}>
        <div className="device-top">
          <div className="card-icon">
            <Fan size={26} />
          </div>

          <span className={devices.fan ? "active-label" : "inactive-label"}>
            {devices.fan ? "ON" : "OFF"}
          </span>
        </div>

        <h3>Fan Power</h3>
        <p>Turn your cooling fan on or off.</p>

        <button
          className={
            devices.fan
              ? "device-button active-button"
              : "device-button"
          }
          onClick={() => setFanPower(!devices.fan)}
          disabled={fanUpdating}
          style={{ marginTop: "15px" }}
        >
          <Power size={17} />
          {fanUpdating
            ? "Updating..."
            : devices.fan
              ? "Turn Fan OFF"
              : "Turn Fan ON"}
        </button>

        <div style={{ marginTop: "28px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "12px"
          }}>
            <label htmlFor="fan-speed">Fan Speed</label>
            <strong>{fanSpeed}%</strong>
          </div>

          <input
            id="fan-speed"
            type="range"
            min="0"
            max="100"
            step="5"
            value={fanSpeed}
            onChange={event => changeFanSpeed(event.target.value)}
            style={{
              width: "100%",
              cursor: "pointer",
              accentColor: "#3b82f6"
            }}
          />

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "8px",
            fontSize: "13px",
            opacity: 0.7
          }}>
            <span>0% — Off</span>
            <span>100% — Maximum</span>
          </div>
        </div>

        {connection.mode === "hc05" && !bluetoothConnected && (
          <p role="status" style={{ marginTop: "15px" }}>
            Connect Bluetooth in Settings before controlling the fan.
          </p>
        )}

        {notice && (
          <p role="status" style={{ marginTop: "15px" }}>
            {notice}
          </p>
        )}
      </div>
    </section>
  );

  const heading = (title, description) => (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="connection-status">
        <span className="status-dot" />
        {connection.mode === "demo"
          ? "Demo Mode"
          : connection.mode === "hc05"
            ? bluetoothConnected
              ? "Bluetooth Connected"
              : "Bluetooth Disconnected"
            : "ESP32 Selected"}
      </div>
    </div>
  );

  // Settings page
  const renderSettings = () => (
    <>
      {heading(
        "Connection Settings",
        "Connect your own smart home hardware."
      )}

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Select Connection Type</h2>
          <span>Choose your hardware</span>
        </div>

        <div className="device-grid">
          <div
            className="device-card"
            style={{
              border: selectedMode === "demo" ? "2px solid #3b82f6" : undefined,
              cursor: "pointer"
            }}
            onClick={() => setSelectedMode("demo")}
          >
            <div className="card-icon"><Home /></div>
            <h3>Demo Mode</h3>
            <p>Use the application without hardware.</p>
            <span className={selectedMode === "demo" ? "active-label" : "inactive-label"}>
              {selectedMode === "demo" ? "SELECTED" : "SELECT"}
            </span>
          </div>

          <div
            className="device-card"
            style={{
              border: selectedMode === "hc05" ? "2px solid #3b82f6" : undefined,
              cursor: "pointer"
            }}
            onClick={() => setSelectedMode("hc05")}
          >
            <div className="card-icon"><Bluetooth /></div>
            <h3>Arduino + HC-05</h3>
            <p>Connect Arduino through your laptop's Bluetooth bridge.</p>
            <span className={selectedMode === "hc05" ? "active-label" : "inactive-label"}>
              {selectedMode === "hc05" ? "SELECTED" : "SELECT"}
            </span>
          </div>

          <div
            className="device-card"
            style={{
              border: selectedMode === "esp32" ? "2px solid #3b82f6" : undefined,
              cursor: "pointer"
            }}
            onClick={() => setSelectedMode("esp32")}
          >
            <div className="card-icon"><Wifi /></div>
            <h3>ESP32 Wi-Fi</h3>
            <p>Connect your ESP32 controller through Wi-Fi.</p>
            <span className={selectedMode === "esp32" ? "active-label" : "inactive-label"}>
              {selectedMode === "esp32" ? "SELECTED" : "SELECT"}
            </span>
          </div>
        </div>
      </section>

      {selectedMode === "hc05" && (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>HC-05 Bluetooth Connection</h2>
            <span>
              {bluetoothConnected
                ? bluetoothSimulated
                  ? "Demo Connected"
                  : "Physically Connected"
                : "Not Connected"}
            </span>
          </div>

          <div className="overview-card" style={{ display: "block" }}>
            <div className="device-top">
              <div className="card-icon">
                <Bluetooth size={26} />
              </div>

              <span className={bridgeRunning ? "active-label" : "inactive-label"}>
                {bridgeRunning ? "BRIDGE ONLINE" : "BRIDGE OFFLINE"}
              </span>
            </div>

            <h3>Local Bluetooth Bridge</h3>

            <p>
              Bridge: {bridgeRunning ? "Running on this laptop" : "Not detected"}
            </p>

            <p>
              Bluetooth: {bluetoothConnected
                ? bluetoothSimulated
                  ? "Demo connection active"
                  : `Connected to ${selectedPort || "HC-05"}`
                : "Disconnected"}
            </p>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "18px"
            }}>
              <button
                className="device-button"
                onClick={loadBluetoothStatusForButton}
                disabled={scanning}
              >
                <RefreshCw size={17} />
                Check Bridge
              </button>

              <button
                className="device-button"
                onClick={scanBluetoothPorts}
                disabled={scanning || !bridgeRunning}
              >
                <RefreshCw size={17} />
                {scanning ? "Scanning..." : "Scan COM Ports"}
              </button>
            </div>

            <div style={{ marginTop: "20px" }}>
              <label htmlFor="bluetooth-port">
                Select HC-05 COM Port
              </label>

              <select
                id="bluetooth-port"
                value={selectedPort}
                onChange={event => setSelectedPort(event.target.value)}
                disabled={!bridgeRunning || bluetoothConnected}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "13px",
                  marginTop: "10px",
                  borderRadius: "8px",
                  border: "1px solid #374151",
                  background: "#111827",
                  color: "white"
                }}
              >
                <option value="">Select a COM port</option>

                {availablePorts.map(port => (
                  <option key={port.path} value={port.path}>
                    {port.path} — {port.manufacturer}
                  </option>
                ))}
              </select>
            </div>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "15px"
            }}>
              <button
                className="device-button active-button"
                onClick={connectBluetooth}
                disabled={
                  !bridgeRunning ||
                  !selectedPort ||
                  connecting ||
                  bluetoothConnected
                }
              >
                <Bluetooth size={17} />
                {connecting ? "Connecting..." : "Connect HC-05"}
              </button>

              <button
                className="device-button"
                onClick={disconnectBluetooth}
                disabled={!bluetoothConnected}
              >
                <Unplug size={17} />
                Disconnect
              </button>
            </div>

            <p style={{ marginTop: "18px" }}>
              Pair your HC-05 with Windows first. Select the outgoing
              Bluetooth COM port created by Windows.
            </p>

            {!bridgeRunning && (
              <p role="status" style={{ marginTop: "12px" }}>
                Start the Bluetooth Bridge in its terminal using npm run dev.
              </p>
            )}

            {notice && (
              <p role="status" style={{ marginTop: "15px" }}>
                {notice}
              </p>
            )}
          </div>

          <div
            className="overview-card"
            style={{ display: "block", marginTop: "18px" }}
          >
            <h3>Test Without Physical Hardware</h3>
            <p>
              Use Demo Bluetooth to test the website without an Arduino or HC-05.
            </p>

            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              marginTop: "15px"
            }}>
              <button
                className="device-button active-button"
                onClick={connectDemoBluetooth}
                disabled={!bridgeRunning || bluetoothConnected}
              >
                <Bluetooth size={17} />
                Connect Demo Bluetooth
              </button>

              <button
                className="device-button"
                onClick={disconnectBluetooth}
                disabled={!bluetoothConnected}
              >
                <Unplug size={17} />
                Disconnect
              </button>
            </div>
          </div>
        </section>
      )}

      {selectedMode === "esp32" && (
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>ESP32 Network Settings</h2>
          </div>

          <div className="overview-card" style={{ display: "block" }}>
            <label htmlFor="esp32-address">
              ESP32 IP Address or API URL
            </label>

            <input
              id="esp32-address"
              type="text"
              value={esp32Url}
              onChange={event => setEsp32Url(event.target.value)}
              placeholder="http://192.168.1.100"
              style={{
                display: "block",
                width: "100%",
                padding: "13px",
                marginTop: "12px",
                marginBottom: "10px",
                borderRadius: "8px",
                border: "1px solid #374151",
                background: "#111827",
                color: "white"
              }}
            />

            <p>Enter the local IP address of your ESP32 controller.</p>
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <button
          className="device-button active-button"
          onClick={saveConnection}
          disabled={saving}
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Connection"}
        </button>

        {notice && selectedMode !== "hc05" && (
          <p role="status" style={{ marginTop: "15px" }}>
            {notice}
          </p>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <h2>Current Configuration</h2>
        </div>

        <div className="overview-card">
          <Server />
          <h3>{connection.controller}</h3>
          <p>Mode: {connection.mode.toUpperCase()}</p>

          <p>
            Status: {connection.mode === "hc05"
              ? bluetoothConnected
                ? bluetoothSimulated
                  ? "Demo Bluetooth Connected"
                  : "Physical Bluetooth Connected"
                : "Bluetooth Disconnected"
              : connection.connected
                ? "Ready"
                : "Not connected"}
          </p>

          <p>{connection.message}</p>

          {connection.esp32Url && (
            <p>ESP32 address: {connection.esp32Url}</p>
          )}
        </div>
      </section>
    </>
  );

  // Dashboard pages
  const renderPage = () => {
    switch (activePage) {
      case "Dashboard":
        return (
          <>
            {heading(
              "Smart Home Dashboard",
              "Monitor and control your home devices."
            )}

            <div className="overview-grid">
              <div className="overview-card">
                <div className="card-icon"><Lightbulb /></div>
                <h3>Room Lights</h3>
                <h2>
                  {Number(devices.bedroomLight) +
                    Number(devices.livingRoomLight)} / 2
                </h2>
                <p>Lights ON</p>
              </div>

              <div className="overview-card">
                <div className="card-icon"><Thermometer /></div>
                <h3>Temperature</h3>
                <h2>{sensorData.temperature}°C</h2>
                <p>Room temperature</p>
              </div>

              <div className="overview-card">
                <div className="card-icon"><Fan /></div>
                <h3>Cooling Fan</h3>
                <h2>{devices.fan ? "ON" : "OFF"}</h2>
                <p>
                  {devices.fan ? `Speed: ${fanSpeed}%` : "Fan stopped"}
                </p>
              </div>

              <div className="overview-card">
                <div className="card-icon"><Shield /></div>
                <h3>Security</h3>
                <h2>{sensorData.motion ? "Motion" : "Safe"}</h2>
                <p>PIR monitoring</p>
              </div>
            </div>

            <section className="dashboard-section">
              <div className="section-heading">
                <h2>Device Controls</h2>
                <span>Device management</span>
              </div>

              {renderDevices(deviceList)}
            </section>

            <section className="dashboard-section">
              <div className="section-heading">
                <h2>Sensor Monitoring</h2>
                <span>Refreshes every 2 seconds</span>
              </div>

              {renderSensors(sensorList)}
            </section>
          </>
        );

      case "Room Lights":
        return (
          <>
            {heading("Room Lights", "Control your room lighting.")}
            {renderDevices(deviceList.slice(0, 2))}
          </>
        );

      case "Climate Control":
        return (
          <>
            {heading(
              "Climate Control",
              "Monitor temperature and control your fan."
            )}

            {renderSensors(sensorList.slice(0, 1))}
            {renderFanControl()}
          </>
        );

      case "Security":
        return (
          <>
            {heading(
              "Security Monitoring",
              "Monitor motion and smoke readings."
            )}

            {renderSensors(sensorList.slice(1, 3))}
          </>
        );

      default:
        return renderSettings();
    }
  };

  // Refresh Bluetooth status from Settings
  async function loadBluetoothStatusForButton() {
    try {
      const response = await fetch(`${BRIDGE}/health`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error("Bridge unavailable");
      }

      setBridgeRunning(true);
      setBluetoothConnected(Boolean(result.connected));
      setBluetoothSimulated(Boolean(result.simulated));
      setSelectedPort(result.simulated ? "" : result.selectedPort || "");
      setNotice("Bluetooth Bridge is running.");
    } catch {
      setBridgeRunning(false);
      setBluetoothConnected(false);
      setBluetoothSimulated(false);
      setNotice("Bluetooth Bridge is not running. Start it on this laptop.");
    }
  }

  return (
    <div className="app-container">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="logo">
          <Home size={27} />
          <h2>SmartHome</h2>

          <button
            className="close-menu"
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </button>
        </div>

        <p className="menu-label">MENU</p>

        <nav>
          {navigation.map(item => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={
                  activePage === item.name
                    ? "nav-item active-nav"
                    : "nav-item"
                }
                onClick={() => {
                  setActivePage(item.name);
                  setMenuOpen(false);
                }}
              >
                <Icon size={20} />
                {item.name}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-status">
            <span className="status-dot" />

            {connection.mode === "demo"
              ? "Demo Active"
              : connection.mode === "hc05"
                ? bluetoothConnected
                  ? "Bluetooth Connected"
                  : "Bluetooth Offline"
                : "ESP32 Selected"}
          </div>

          <p>Smart Home Automation</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(true)}
          >
            <Menu />
          </button>

          <div>
            <span>SMART HOME</span>
            <h3>Control Center</h3>
          </div>

          <div className="topbar-right">
            <Moon size={20} />
            <span>{connection.mode.toUpperCase()}</span>
          </div>
        </header>

        <div className="content-area">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
