import React from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const BundleGenerator = () => {
  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Bundle</h1>
          <p className="text-lg text-gray-700">
            Build your perfect bundle at{' '}
            <a 
              href="https://cleverpoly.store/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-800 font-semibold hover:text-amber-900 hover:underline"
            >
              Cleverpoly.Store
            </a>{' '}
            and save up to 30%
          </p>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Bundle Generator</h2>
          <p className="text-gray-600 mb-8">
            Create custom product bundles with progressive discounts
          </p>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900">Features:</h3>
              <ul className="mt-2 text-gray-600 space-y-1">
                <li>• Email verification system</li>
                <li>• Progressive discounts up to 30%</li>
                <li>• 35+ premium products</li>
                <li>• Secure payment processing</li>
              </ul>
            </div>
            
            <p className="text-gray-500 text-sm">
              Application is loading...
            </p>
          </div>
        </div>
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