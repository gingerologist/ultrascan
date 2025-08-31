const net = require('net');

// Get IP address from command line arguments
const ipAddress = process.argv[2];

if (!ipAddress) {
  console.error('Usage: node script.js <ip_address>');
  process.exit(1);
}

// Create TCP connection
const client = new net.Socket();

client.connect(7332, ipAddress, () => {
  console.log(`Connected to ${ipAddress}:7332`);

  const jsonString = '{"test":"parse-print-json"}';
  client.write(jsonString + '\n');
  console.log(`Sent: ${jsonString}`);

  // Close the connection
  client.end();
});

client.on('close', () => {
  console.log('Connection closed');
});

client.on('error', err => {
  console.error('Connection error:', err.message);
});
