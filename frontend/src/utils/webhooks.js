const WEBHOOK_URL = 'https://hook.us2.make.com/vfar8onjq8w3fgv18s9yonqeh6y67m5h';

export const sendVerificationCode = async (email, name) => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'send_verification_code',
        customerEmail: email,
        customerName: name,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, error: 'Network error', message: 'Failed to send verification code' };
  }
};

export const verifyCode = async (sessionId, code) => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'verify_code',
        sessionId,
        verificationCode: code,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error verifying code:', error);
    return { success: false, error: 'NETWORK_ERROR', message: 'Failed to verify code' };
  }
};

export const createBundle = async (bundleData) => {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'create_bundle',
        ...bundleData,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating bundle:', error);
    return { success: false, error: 'NETWORK_ERROR', message: 'Failed to create bundle' };
  }
};