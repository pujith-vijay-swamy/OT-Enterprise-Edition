import axios from 'axios';

export async function sendPaymentReceipt(userId: string, chargeId: string) {
  // Fetch user email from user-service
  const userRes = await axios.get(`http://user-service:8000/api/v1/users/${userId}`);
  const userEmail = userRes.data.email;

  // Fetch payment details from payment-gateway
  const paymentRes = await axios.get(`http://payment-gateway:8080/api/v1/payments/history/${userId}`);
  const paymentHistory = paymentRes.data;

  console.log(`Sending email receipt to ${userEmail} for charge ${chargeId}`);
  return { status: 'SENT', recipient: userEmail, history: paymentHistory };
}
