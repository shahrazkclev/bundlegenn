import React, { useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ExternalLink, CheckCircle, Package } from 'lucide-react';
import { 
  products, 
  disabledWhenLazyMotionSelected, 
  specialBundleProducts, 
  specialBundleStripeLink,
  discountTiers 
} from './data/products';
import { 
  sendVerificationCode, 
  verifyCode, 
  createBundle 
} from './utils/webhooks';

const BundleGenerator = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    sessionId: '',
    verificationCode: '',
    savedVerificationCode: ''
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bundleCreating, setBundleCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [error, setError] = useState('');
  const [bundleResponse, setBundleResponse] = useState(null);
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const emailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com'];

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, email: value }));
    
    if (value.includes('@') && value.split('@')[1].length > 0) {
      const domain = value.split('@')[1];
      const suggestions = emailDomains
        .filter(d => d.toLowerCase().startsWith(domain.toLowerCase()))
        .map(d => value.split('@')[0] + '@' + d);
      setEmailSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectEmailSuggestion = (suggestion) => {
    setFormData(prev => ({ ...prev, email: suggestion }));
    setShowSuggestions(false);
  };

  const isSpecialBundle = specialBundleProducts.every(id => selectedProducts.includes(id)) &&
                          selectedProducts.length === specialBundleProducts.length;

  let subtotal, discountPercentage, discountAmount, finalAmount;

  if (isSpecialBundle) {
    subtotal = 184;
    discountPercentage = 0;
    discountAmount = 35;
    finalAmount = 149;
  } else {
    subtotal = selectedProducts.reduce((sum, productId) => {
      const product = products.find(p => p.id === productId);
      return sum + (product?.price || 0);
    }, 0);

    const discountTier = discountTiers.find(tier => selectedProducts.length >= tier.min && selectedProducts.length <= tier.max);
    discountPercentage = discountTier?.percentage || 0;
    discountAmount = (subtotal * discountPercentage) / 100;
    finalAmount = subtotal - discountAmount;
  }

  const isLazyMotionSelected = selectedProducts.includes(1);

  const availableProducts = products.filter(product => {
    if (isLazyMotionSelected && disabledWhenLazyMotionSelected.includes(product.id)) {
      return false;
    }
    return true;
  });

  const handleProductToggle = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        if (productId === 1) {
          return [productId, ...prev.filter(id => !disabledWhenLazyMotionSelected.includes(id))];
        }
        return [...prev, productId];
      }
    });
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.name) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setEmailSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const sessionId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setFormData(prev => ({ ...prev, sessionId }));
    
    sendVerificationCode(formData.email, formData.name, sessionId).catch(err => {
      console.error('Background webhook error:', err);
    });
    
    setEmailSubmitting(false);
    setCurrentStep(2);
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    if (!formData.verificationCode) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await verifyCode(formData.sessionId, formData.verificationCode);
      if (result.success) {
        setFormData(prev => ({ ...prev, savedVerificationCode: formData.verificationCode }));
        setCurrentStep(3);
      } else {
        if (result.error === 'INVALID_CODE') {
          setError('Invalid or expired code. Please try again.');
        } else {
          setError(result.message || 'Verification failed');
        }
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBundleSubmit = async () => {
    if (selectedProducts.length === 0) {
      setError('Please select at least one product');
      return;
    }

    if (isSpecialBundle) {
      window.open(specialBundleStripeLink, '_blank');
      return;
    }

    setBundleCreating(true);
    setError('');

    const progressInterval = setInterval(() => {
      setCreationProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const bundleData = {
        sessionId: formData.sessionId,
        customerName: formData.name,
        customerEmail: formData.email,
        verificationCode: formData.savedVerificationCode,
        products: selectedProducts.map((productId, index) => {
          const product = products.find(p => p.id === productId);
          return {
            sequenceNumber: index + 1,
            priceId: product.priceId,
            productName: product.name,
            price: product.price,
            quantity: 1
          };
        }),
        totalProducts: selectedProducts.length,
        totalAmount: subtotal,
        discountPercentage,
        discountAmount,
        finalAmount: finalAmount,
        timestamp: new Date().toISOString()
      };

      const result = await createBundle(bundleData);
      
      setCreationProgress(100);
      
      if (result.success) {
        setBundleResponse(result);
        setTimeout(() => {
          setCurrentStep(4);
        }, 500);
      } else {
        setError(result.message || 'Failed to create bundle');
      }
    } catch (err) {
      setError('Failed to create bundle. Please try again.');
    } finally {
      setBundleCreating(false);
      setCreationProgress(0);
    }
  };

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">Step {currentStep} of 4</span>
        <span className="text-sm text-gray-600">{Math.round((currentStep / 4) * 100)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-amber-600 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${(currentStep / 4) * 100}%` }}
        ></div>
      </div>
    </div>
  );

  const renderEmailStep = () => (
    <div className="w-full max-w-md mx-auto bg-white border border-gray-300 shadow-lg rounded-lg">
      <div className="p-6">
        <h2 className="text-center text-gray-900 text-xl font-bold mb-6">Get Started</h2>
        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="relative">
            <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-1">Email Address</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleEmailChange}
              onFocus={() => setShowSuggestions(emailSuggestions.length > 0)}
              placeholder="Enter your email"
              className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
            />
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md mt-2 z-10 shadow-lg">
                {emailSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => selectEmailSuggestion(suggestion)}
                    className="px-3 py-2 hover:bg-amber-50 cursor-pointer text-gray-700 text-sm border-b border-gray-100 last:border-b-0"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-1">Full Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              className="w-full px-3 py-2 bg-white border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          <button 
            type="submit" 
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-md transition-colors"
            disabled={emailSubmitting}
          >
            {emailSubmitting ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="w-full max-w-md mx-auto bg-white border border-gray-300 shadow-lg rounded-lg">
      <div className="p-6">
        <h2 className="text-center text-gray-900 text-xl font-bold mb-2">Verify Your Email</h2>
        <p className="text-center text-gray-600 mb-6">
          We've sent a 4-digit code to {formData.email}
        </p>
        <form onSubmit={handleVerificationSubmit} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-gray-700 text-sm font-medium mb-1">Verification Code</label>
            <input
              id="code"
              type="text"
              maxLength="4"
              value={formData.verificationCode}
              onChange={(e) => setFormData(prev => ({ ...prev, verificationCode: e.target.value }))}
              placeholder="Enter 4-digit code"
              className="w-full px-3 py-2 text-center text-lg tracking-widest bg-white border border-gray-300 text-gray-900 placeholder-gray-500 rounded-md focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          <button 
            type="submit" 
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-md transition-colors" 
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </button>
        </form>
      </div>
    </div>
  );

  const renderProductSelection = () => (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select Products</h2>
        <button
          onClick={() => window.open('https://cleverpoly.store/', '_blank')}
          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-amber-50 transition-colors"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          See all Products
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProducts.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const isDisabled = isLazyMotionSelected && disabledWhenLazyMotionSelected.includes(product.id);
              
              return (
                <div 
                  key={product.id} 
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg bg-white border border-gray-300 rounded-lg p-4 ${
                    isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : ''
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && handleProductToggle(product.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        disabled={isDisabled}
                        onChange={() => {}}
                        className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                      />
                      <div>
                        <h3 className="font-medium text-sm text-gray-900">{product.name}</h3>
                        <span className="inline-block mt-1 px-2 py-1 text-xs border border-gray-400 text-gray-600 rounded">
                          {product.category}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-lg text-gray-900">${product.price}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 bg-white border border-gray-300 shadow-lg rounded-lg p-6">
            <h3 className="text-gray-900 text-lg font-bold mb-4">Order Summary</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Selected Items:</span>
                  <span>{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span>${subtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount {discountPercentage > 0 ? `(${discountPercentage}%)` : ''}:</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2">
                  <div className="flex justify-between font-bold text-lg text-gray-900">
                    <span>Total:</span>
                    <span>${finalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedProducts.length > 1 && discountAmount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm text-amber-800">
                    You're saving ${discountAmount.toFixed(2)} with {selectedProducts.length} products!
                  </p>
                </div>
              )}

              {bundleCreating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Creating bundle...</span>
                    <span>{creationProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-amber-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${creationProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <button 
                onClick={handleBundleSubmit} 
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
                disabled={bundleCreating || selectedProducts.length === 0}
              >
                {bundleCreating ? (
                  <span className="flex items-center justify-center">
                    <Package className="w-4 h-4 mr-2 animate-spin" />
                    Creating Bundle...
                  </span>
                ) : (
                  'Create Bundle'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="w-full max-w-md mx-auto bg-white border border-gray-300 shadow-lg rounded-lg">
      <div className="p-6">
        <h2 className="text-center text-gray-900 text-xl font-bold mb-4 flex items-center justify-center gap-2">
          <CheckCircle className="w-5 h-5 text-amber-600" />
          Bundle Created Successfully!
        </h2>
        <div className="text-center space-y-4">
          <p className="text-gray-700">
            Your bundle has been created successfully. Click the button below to proceed to payment.
          </p>
          
          {bundleResponse?.invoiceUrl && (
            <button 
              onClick={() => window.open(bundleResponse.invoiceUrl, '_blank')}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Proceed to Payment
            </button>
          )}
          
          <div className="border-t border-gray-300 pt-4">
            <button 
              onClick={() => {
                setCurrentStep(1);
                setFormData({ email: '', name: '', sessionId: '', verificationCode: '', savedVerificationCode: '' });
                setSelectedProducts([]);
                setError('');
                setBundleResponse(null);
              }}
              className="w-full bg-white border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md hover:bg-gray-50 transition-colors"
            >
              Create Another Bundle
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4 relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle, #8b5a3c 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }}
      />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Bundle</h1>
          <p className="text-lg text-gray-700">
            Build your perfect bundle at{' '}
            <a 
              href="https://cleverpoly.store/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-800 font-semibold hover:text-amber-900 hover:underline transition-colors cursor-pointer"
            >
              Cleverpoly.Store
            </a>{' '}
            and save up to 30%
          </p>
        </div>

        {renderProgressBar()}

        {currentStep === 1 && renderEmailStep()}
        {currentStep === 2 && renderVerificationStep()}
        {currentStep === 3 && renderProductSelection()}
        {currentStep === 4 && renderSuccess()}
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<BundleGenerator />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;