// Mock functions for webhook calls (frontend-only implementation)
export const mockSendVerificationCode = async (email, name) => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate mock session ID
  const sessionId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  
  // Store in localStorage for mock verification
  localStorage.setItem('mockSession', JSON.stringify({
    sessionId,
    email,
    name,
    verificationCode: '1234', // Mock code for testing
    timestamp: Date.now()
  }));
  
  console.log('Mock webhook call - send_verification_code:', {
    action: 'send_verification_code',
    customerEmail: email,
    customerName: name,
    sessionId
  });
  
  return { success: true, sessionId };
};

export const mockVerifyCode = async (sessionId, code) => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const mockSession = JSON.parse(localStorage.getItem('mockSession') || '{}');
  
  if (mockSession.sessionId === sessionId && code === mockSession.verificationCode) {
    console.log('Mock webhook call - verify_code:', {
      action: 'verify_code',
      sessionId,
      verificationCode: code
    });
    return { success: true };
  }
  
  return { success: false, error: 'Invalid verification code' };
};

export const mockCreateBundle = async (bundleData) => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  console.log('Mock webhook call - create_bundle:', {
    action: 'create_bundle',
    ...bundleData
  });
  
  // For the special bundle case, don't actually "create" since Stripe link exists
  if (bundleData.isSpecialBundle) {
    return { 
      success: true, 
      redirectUrl: bundleData.stripeLink,
      message: 'Redirecting to pre-configured checkout...'
    };
  }
  
  return { 
    success: true, 
    bundleId: `bundle_${Date.now()}`,
    message: 'Bundle created successfully!'
  };
};