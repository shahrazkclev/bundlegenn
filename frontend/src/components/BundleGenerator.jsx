import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { Separator } from './ui/separator';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { ExternalLink, CheckCircle, Package } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { 
  products, 
  disabledWhenLazyMotionSelected, 
  specialBundleProducts, 
  specialBundleStripeLink,
  discountTiers 
} from '../data/products';
import { 
  sendVerificationCode, 
  verifyCode, 
  createBundle 
} from '../utils/webhooks';

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
  const { toast } = useToast();

  // Email domain suggestions
  const emailDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com'];

  // Handle email input and suggestions
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

  // Calculate totals and discounts based on product count
  const isSpecialBundle = specialBundleProducts.every(id => selectedProducts.includes(id)) &&
                          selectedProducts.length === specialBundleProducts.length;

  let subtotal, discountPercentage, discountAmount, finalAmount;

  if (isSpecialBundle) {
    // Special bundle: fixed pricing
    subtotal = 184;
    discountPercentage = 0; // Don't show percentage
    discountAmount = 35; // Fixed discount amount
    finalAmount = 149;
  } else {
    // Regular bundle: calculate from individual prices
    subtotal = selectedProducts.reduce((sum, productId) => {
      const product = products.find(p => p.id === productId);
      return sum + (product?.price || 0);
    }, 0);

    const discountTier = discountTiers.find(tier => selectedProducts.length >= tier.min && selectedProducts.length <= tier.max);
    discountPercentage = discountTier?.percentage || 0;
    discountAmount = (subtotal * discountPercentage) / 100;
    finalAmount = subtotal - discountAmount;
  }

  // Check if Lazy-Motion Library is selected
  const isLazyMotionSelected = selectedProducts.includes(1);

  // Filter products based on selection rules
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
        // If selecting Lazy-Motion Library, remove disabled products
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
    
    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate session ID on frontend
    const sessionId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setFormData(prev => ({ ...prev, sessionId }));
    
    // Fire webhook in background (don't wait for response)
    sendVerificationCode(formData.email, formData.name, sessionId).catch(err => {
      console.error('Background webhook error:', err);
    });
    
    setEmailSubmitting(false);
    // Immediately proceed to verification step
    setCurrentStep(2);
    toast({
      title: "Verification code sent!",
      description: "Check your email for the 4-digit code.",
    });
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
        // Save the verified code for later use
        setFormData(prev => ({ ...prev, savedVerificationCode: formData.verificationCode }));
        setCurrentStep(3);
        toast({
          title: "Email verified!",
          description: "Now select your products to create a bundle.",
        });
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

    // For special bundle, redirect directly to Stripe without calling make.com
    if (isSpecialBundle) {
      window.open(specialBundleStripeLink, '_blank');
      toast({
        title: "Redirecting to payment!",
        description: "You're being redirected to complete your purchase.",
      });
      return;
    }

    setBundleCreating(true);
    setError('');

    // Simulate progress animation
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
      
      // Complete progress
      setCreationProgress(100);
      
      if (result.success) {
        setBundleResponse(result);
        setTimeout(() => {
          setCurrentStep(4);
          toast({
            title: "Bundle created!",
            description: result.message || "Your bundle has been created successfully.",
          });
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
      <Progress value={(currentStep / 4) * 100} className="w-full" />
    </div>
  );

  const renderEmailStep = () => (
    <Card className="w-full max-w-md mx-auto bg-white border-gray-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-gray-900">Get Started</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSubmit} className="space-y-6">
          <div className="relative">
            <Label htmlFor="email" className="text-gray-700">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleEmailChange}
              onFocus={() => setShowSuggestions(emailSuggestions.length > 0)}
              placeholder="Enter your email"
              className="bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:ring-amber-500"
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
            <Label htmlFor="name" className="text-gray-700">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              className="bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:ring-amber-500"
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button 
            type="submit" 
            className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            disabled={emailSubmitting}
          >
            {emailSubmitting ? 'Sending...' : 'Send Verification Code'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderVerificationStep = () => (
    <Card className="w-full max-w-md mx-auto bg-white border-gray-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-gray-900">Verify Your Email</CardTitle>
        <p className="text-center text-gray-600">
          We've sent a 4-digit code to {formData.email}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerificationSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code" className="text-gray-700">Verification Code</Label>
            <Input
              id="code"
              type="text"
              maxLength="4"
              value={formData.verificationCode}
              onChange={(e) => setFormData(prev => ({ ...prev, verificationCode: e.target.value }))}
              placeholder="Enter 4-digit code"
              className="text-center text-lg tracking-widest bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-amber-500 focus:ring-amber-500"
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button 
            type="submit" 
            className="w-full bg-gray-900 hover:bg-gray-800 text-white" 
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderProductSelection = () => (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Select Products</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open('https://cleverpoly.store/products', '_blank')}
          className="bg-white border-gray-300 text-gray-700 hover:bg-amber-50"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          See all Products
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProducts.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const isDisabled = isLazyMotionSelected && disabledWhenLazyMotionSelected.includes(product.id);
              
              return (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all duration-200 hover:shadow-lg bg-white border-gray-300 ${
                    isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : ''
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !isDisabled && handleProductToggle(product.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={isSelected} 
                          disabled={isDisabled}
                          onChange={() => {}} 
                          className="border-gray-400"
                        />
                        <div>
                          <h3 className="font-medium text-sm text-gray-900">{product.name}</h3>
                          <Badge variant="outline" className="mt-1 text-xs border-gray-400 text-gray-600">
                            {product.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-gray-900">${product.price}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6 bg-white border-gray-300 shadow-lg">
            <CardHeader>
              <CardTitle className="text-gray-900">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Selected Items:</span>
                  <span>{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal:</span>
                  <span>${subtotal}</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Discount ({discountPercentage}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator className="bg-gray-300" />
                <div className="flex justify-between font-bold text-lg text-gray-900">
                  <span>Total:</span>
                  <span>${isSpecialBundle ? '149.00' : finalAmount.toFixed(2)}</span>
                </div>
              </div>

              {selectedProducts.length > 1 && discountPercentage > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="text-sm text-amber-800">
                    You're saving ${discountAmount.toFixed(2)} with {selectedProducts.length} products!
                  </AlertDescription>
                </Alert>
              )}

              {isSpecialBundle && (
                <Alert className="bg-gray-50 border-gray-200">
                  <AlertDescription className="text-sm text-gray-700">
                    Special Bundle Detected! You're getting the premium package at a discounted rate.
                  </AlertDescription>
                </Alert>
              )}

              {bundleCreating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Creating bundle...</span>
                    <span>{creationProgress}%</span>
                  </div>
                  <Progress value={creationProgress} className="w-full" />
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleBundleSubmit} 
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
                disabled={bundleCreating || selectedProducts.length === 0}
              >
                {bundleCreating ? (
                  <>
                    <Package className="w-4 h-4 mr-2 animate-spin" />
                    Creating Bundle...
                  </>
                ) : (
                  'Create Bundle'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <Card className="w-full max-w-md mx-auto bg-white border-gray-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-center text-gray-900 flex items-center justify-center gap-2">
          <CheckCircle className="w-5 h-5 text-amber-600" />
          Bundle Created Successfully!
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-gray-700">
          Your bundle has been created successfully. Click the button below to proceed to payment.
        </p>
        
        {bundleResponse?.invoiceUrl && (
          <Button 
            onClick={() => window.open(bundleResponse.invoiceUrl, '_blank')}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            Proceed to Payment
          </Button>
        )}
        
        {isSpecialBundle && (
          <>
            <p className="text-sm text-amber-800 font-medium">
              Special Bundle Package - Premium Deal!
            </p>
            <Button 
              onClick={() => window.open(specialBundleStripeLink, '_blank')}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white"
            >
              Pay with Special Bundle Link
            </Button>
          </>
        )}
        
        <Separator className="bg-gray-300" />
        
        <Button 
          onClick={() => {
            setCurrentStep(1);
            setFormData({ email: '', name: '', sessionId: '', verificationCode: '', savedVerificationCode: '' });
            setSelectedProducts([]);
            setError('');
            setBundleResponse(null);
          }}
          variant="outline"
          className="w-full bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Create Another Bundle
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4 relative overflow-hidden">
      {/* Grid background */}
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
            Build your perfect bundle at <span className="text-amber-800 font-semibold">Cleverpoly.Store</span> and save up to 30%
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

export default BundleGenerator;