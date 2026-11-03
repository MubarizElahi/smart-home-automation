let bluetoothPort = null;
let writer = null;

export const isBluetoothSupported = () => {
  return "serial" in navigator;
};

export const connectBluetooth = async () => {
  if (!isBluetoothSupported()) {
    throw new Error("Web Serial is not supported. Please use Chrome or Edge.");
  }

  // Opens the browser's serial-port selection window.
  bluetoothPort = await navigator.serial.requestPort();

  await bluetoothPort.open({
    baudRate: 9600
  });

  writer = bluetoothPort.writable.getWriter();

  return true;
};

export const sendBluetoothCommand = async (command) => {
  if (!writer) {
    throw new Error("Please connect your HC-05 first.");
  }

  const data = new TextEncoder().encode(`${command}\n`);

  await writer.write(data);

  return true;
};

export const disconnectBluetooth = async () => {
  if (writer) {
    writer.releaseLock();
    writer = null;
  }

  if (bluetoothPort) {
    if (bluetoothPort.readable || bluetoothPort.writable) {
      await bluetoothPort.close();
    }

    bluetoothPort = null;
  }

  return true;
};