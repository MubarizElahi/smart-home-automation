
const API_URL = "http://localhost:5000/api";

export const getSensorData = async () => {
  try {
    const response = await fetch(`${API_URL}/sensors`);

    if (!response.ok) {
      throw new Error("Unable to fetch sensor data");
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("Sensor API error:", error);
    return null;
  }
};

export const getDeviceData = async () => {
  try {
    const response = await fetch(`${API_URL}/devices`);

    if (!response.ok) {
      throw new Error("Unable to fetch device data");
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("Device API error:", error);
    return null;
  }
};

export const updateDevice = async (device, state) => {
  const response = await fetch(`${API_URL}/devices/${device}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });

  if (!response.ok) {
    throw new Error("Unable to update device");
  }

  return response.json();
};
