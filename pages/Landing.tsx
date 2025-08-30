
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Loader: React.FC = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="text-center animate-fadeInDown">
            <h1 className="text-5xl font-bold text-slate-800 mb-4">Campus Vote</h1>
            <div className="flex items-center justify-center space-x-3 mt-2">
                <svg className="animate-spin h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-slate-600 text-lg animate-pulse">your vote your platform</p>
            </div>
        </div>
    </div>
);

const MainContent: React.FC = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center animate-fadeIn">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">Campus Vote</h1>
            <p className="text-slate-600 mb-8">Welcome to the official online voting platform. Please select your portal to continue.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                    to="/register"
                    className="w-full sm:w-auto text-center px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
                >
                    Voter Registration
                </Link>
                <Link
                    to="/admin"
                    className="w-full sm:w-auto text-center px-8 py-4 bg-slate-700 text-white font-semibold rounded-lg shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-75 transition-transform transform hover:scale-105"
                >
                    Admin Portal
                </Link>
            </div>
        </div>
    </div>
);

const Landing: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 3000); // 3-second loader display time

        return () => clearTimeout(timer);
    }, []);

    return isLoading ? <Loader /> : <MainContent />;
};

export default Landing;