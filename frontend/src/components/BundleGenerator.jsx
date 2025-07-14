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
    verificationCode: ''
  });
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bundleResponse, setBundleResponse] = useState(null);
  const { toast } = useToast();

  // Calculate totals and discounts
  const subtotal = selectedProducts.reduce((sum, productId) => {
    const product = products.find(p => p.id === productId);
    return sum + (product?.price || 0);
  }, 0);

  const discountTier = discountTiers.find(tier => subtotal >= tier.min && subtotal < tier.max);
  const discountPercentage = discountTier?.percentage || 0;
  const discountAmount = (subtotal * discountPercentage) / 100;
  const finalAmount = subtotal - discountAmount;

  // Check if special bundle is selected
  const isSpecialBundle = specialBundleProducts.every(id => selectedProducts.includes(id)) &&
                          selectedProducts.length === specialBundleProducts.length;

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
    
    // Generate session ID on frontend
    const sessionId = `bundle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setFormData(prev => ({ ...prev, sessionId }));
    
    // Fire webhook in background (don't wait for response)
    sendVerificationCode(formData.email, formData.name, sessionId).catch(err => {
      console.error('Background webhook error:', err);
    });
    
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

    setLoading(true);
    setError('');

    try {
      const bundleData = {
        sessionId: formData.sessionId,
        customerName: formData.name,
        customerEmail: formData.email,
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
        finalAmount: isSpecialBundle ? 149 : finalAmount,
        timestamp: new Date().toISOString(),
        isSpecialBundle,
        stripeLink: isSpecialBundle ? specialBundleStripeLink : null
      };

      const result = await createBundle(bundleData);
      if (result.success) {
        setBundleResponse(result);
        setCurrentStep(4);
        toast({
          title: "Bundle created!",
          description: result.message || "Your bundle has been created successfully.",
        });
      } else {
        setError(result.message || 'Failed to create bundle');
      }
    } catch (err) {
      setError('Failed to create bundle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Step {currentStep} of 4</span>
        <span className="text-sm text-gray-600">{Math.round((currentStep / 4) * 100)}%</span>
      </div>
      <Progress value={(currentStep / 4) * 100} className="w-full" />
    </div>
  );

  const renderEmailStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Get Started</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter your email"
              required
            />
          </div>
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter your full name"
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full">
            Send Verification Code
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderVerificationStep = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Verify Your Email</CardTitle>
        <p className="text-center text-gray-600">
          We've sent a 4-digit code to {formData.email}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleVerificationSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              maxLength="4"
              value={formData.verificationCode}
              onChange={(e) => setFormData(prev => ({ ...prev, verificationCode: e.target.value }))}
              placeholder="Enter 4-digit code"
              className="text-center text-lg tracking-widest"
              required
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderProductSelection = () => (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold mb-6">Select Products</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableProducts.map((product) => {
              const isSelected = selectedProducts.includes(product.id);
              const isDisabled = isLazyMotionSelected && disabledWhenLazyMotionSelected.includes(product.id);
              
              return (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
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
                        />
                        <div>
                          <h3 className="font-medium text-sm">{product.name}</h3>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {product.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg">${product.price}</span>
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
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Selected Items:</span>
                  <span>{selectedProducts.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal}</span>
                </div>
                {discountPercentage > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({discountPercentage}%):</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${isSpecialBundle ? '149.00' : finalAmount.toFixed(2)}</span>
                </div>
              </div>

              {isSpecialBundle && (
                <Alert>
                  <AlertDescription className="text-sm">
                    🎉 Special Bundle Detected! You're getting the premium package at a discounted rate.
                  </AlertDescription>
                </Alert>
              )}

              {discountPercentage > 0 && !isSpecialBundle && (
                <Alert>
                  <AlertDescription className="text-sm">
                    💰 You're saving ${discountAmount.toFixed(2)} with your {discountPercentage}% discount!
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleBundleSubmit} 
                className="w-full"
                disabled={loading || selectedProducts.length === 0}
              >
                {loading ? 'Creating Bundle...' : 'Create Bundle'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-center text-green-600">Bundle Created Successfully!</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-gray-600">
          Your bundle has been created successfully. Click the button below to proceed to payment.
        </p>
        
        {bundleResponse?.invoiceUrl && (
          <Button 
            onClick={() => window.open(bundleResponse.invoiceUrl, '_blank')}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Proceed to Payment
          </Button>
        )}
        
        {isSpecialBundle && (
          <>
            <p className="text-sm text-green-600 font-medium">
              Special Bundle Package - Premium Deal!
            </p>
            <Button 
              onClick={() => window.open(specialBundleStripeLink, '_blank')}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              Pay with Special Bundle Link
            </Button>
          </>
        )}
        
        <Separator />
        
        <Button 
          onClick={() => {
            setCurrentStep(1);
            setFormData({ email: '', name: '', sessionId: '', verificationCode: '' });
            setSelectedProducts([]);
            setError('');
            setBundleResponse(null);
          }}
          variant="outline"
          className="w-full"
        >
          Create Another Bundle
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bundle Generator</h1>
          <p className="text-lg text-gray-600">Create custom bundles and save up to 30%</p>
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