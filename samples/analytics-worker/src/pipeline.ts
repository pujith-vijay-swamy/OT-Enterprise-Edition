import fetch from 'node-fetch';

export async function processOrderTelemetry(orderId: string) {
  const response = await fetch(`http://order-service:9000/api/v1/orders/${orderId}`);
  if (response.ok) {
    const orderData = await response.json();
    console.log(`Ingested order ${orderId} telemetry into Data Lake`, orderData);
    return { status: 'PROCESSED', orderId };
  }
  throw new Error(`Failed to fetch order ${orderId}`);
}
