
import { useState } from "react";
import { Bluetooth, Power, Unplug } from "lucide-react";

const BRIDGE = "http://localhost:5001";

export default function BluetoothDemoPanel() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lights, setLights] = useState({
    bedroomLight: false,
    livingRoomLight: false
  });

  const connect = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${BRIDGE}/api/demo/connect`, {
        method: "POST"
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setConnected(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message || "Could not connect demo Bluetooth.");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      const response = await fetch(`${BRIDGE}/api/demo/disconnect`, {
        method: "POST"
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setConnected(false);
      setMessage(result.message);
    } catch (error) {
      setMessage(error.message || "Could not disconnect.");
    }
  };

  const toggleLight = async (device) => {
    if (!connected) {
      setMessage("Connect demo Bluetooth first.");
      return;
    }

    const newState = !lights[device];

    try {
      const response = await fetch(`${BRIDGE}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, state: newState })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setLights(previous => ({
        ...previous,
        [device]: newState
      }));

      setMessage(result.message);
    } catch (error) {
      setMessage(error.message || "Command failed.");
    }
  };

  return (
    <section className="dashboard-section">
      <div className="section-heading">
        <h2>Bluetooth Demo Simulator</h2>
        <span>{connected ? "Connected" : "Disconnected"}</span>
      </div>

      <div className="overview-card" style={{ display: "block" }}>
        <Bluetooth size={28} />

        <h3>Virtual HC-05 Connection</h3>

        <p>
          Status: {connected ? "Demo Bluetooth Connected" : "Disconnected"}
        </p>

        <button
          className="device-button active-button"
          onClick={connect}
          disabled={loading || connected}
        >
          <Bluetooth size={17} />
          {loading ? "Connecting..." : "Connect Demo Bluetooth"}
        </button>

        <button
          className="device-button"
          onClick={disconnect}
          disabled={!connected}
          style={{ marginLeft: "10px" }}
        >
          <Unplug size={17} />
          Disconnect
        </button>

        <div style={{ marginTop: "25px" }}>
          <h3>Simulated Arduino Lights</h3>

          {[
            { key: "bedroomLight", name: "Bedroom Light" },
            { key: "livingRoomLight", name: "Living Room Light" }
          ].map(light => (
            <div
              key={light.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                padding: "12px 0",
                borderBottom: "1px solid #374151"
              }}
            >
              <span>{light.name}: {lights[light.key] ? "ON" : "OFF"}</span>

              <button
                className={
                  lights[light.key]
                    ? "device-button active-button"
                    : "device-button"
                }
                disabled={!connected}
                onClick={() => toggleLight(light.key)}
              >
                <Power size={16} />
                {lights[light.key] ? "Turn OFF" : "Turn ON"}
              </button>
            </div>
          ))}
        </div>

        {message && (
          <p role="status" style={{ marginTop: "15px" }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: "15px" }}>
          This is a software simulation. No physical Arduino or HC-05 is
          connected.
        </p>
      </div>
    </section>
  );
}

